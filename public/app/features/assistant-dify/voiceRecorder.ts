import { BrowserSpeechCapture } from './browserSpeech';

/**
 * Manual voice capture: mic to start, send to finish.
 * Uses browser speech recognition when available; otherwise records audio for Dify STT.
 */
export class DifyVoiceRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private speechCapture: BrowserSpeechCapture | null = null;
  private chunks: Blob[] = [];
  private mimeType = '';

  /** True when the browser is transcribing speech locally (Chrome/Edge). */
  usesBrowserSpeech = false;

  async start(): Promise<void> {
    this.chunks = [];
    this.speechCapture = new BrowserSpeechCapture();
    this.usesBrowserSpeech = this.speechCapture.start();

    // Always record audio as fallback when browser speech is unavailable or empty.
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!this.usesBrowserSpeech) {
        throw new Error('Microphone not available');
      }
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.mimeType = pickRecorderMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.start(250);
  }

  cancel(): void {
    this.speechCapture?.cancel();
    this.speechCapture = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  async stop(): Promise<{ text?: string; audio?: Blob; usedBrowserSpeech: boolean }> {
    const speechText = (await this.speechCapture?.stop()) ?? '';
    this.speechCapture = null;
    const usedBrowserSpeech = this.usesBrowserSpeech;
    this.usesBrowserSpeech = false;

    if (speechText) {
      this.cleanupMedia();
      return { text: speechText, usedBrowserSpeech: true };
    }

    const audio = await this.stopMediaRecording();
    return { audio, usedBrowserSpeech: false };
  }

  private cleanupMedia(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private async stopMediaRecording(): Promise<Blob> {
    const recorder = this.mediaRecorder;
    const stream = this.stream;
    if (!recorder || !stream) {
      throw new Error('No audio recorded');
    }

    const recordedBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = this.mimeType || recorder.mimeType || 'audio/webm';
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.onerror = () => reject(new Error('Recording failed'));
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve(new Blob(this.chunks, { type: this.mimeType || 'audio/webm' }));
      }
    });

    stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];

    if (recordedBlob.size < 500) {
      throw new Error('Recording too short');
    }

    return prepareAudioForDify(recordedBlob);
  }
}

function pickRecorderMimeType(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

async function prepareAudioForDify(blob: Blob): Promise<Blob> {
  const type = blob.type || '';

  // Prefer native container when Dify accepts it (mp4/m4a on Safari/Mac).
  if (type.includes('mp4')) {
    return blob;
  }

  // Convert webm/ogg to mono WAV at native sample rate.
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const mono = mixToMono(decoded);
      return encodeWavBlob(mono, decoded.sampleRate);
    } finally {
      await audioContext.close();
    }
  } catch {
    return blob;
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = buffer;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numberOfChannels;
    }
  }
  return mono;
}

function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function formatTranscriptionError(message: string): string {
  const decoded = message
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

  if (decoded.includes('corrupted') || decoded.includes('unsupported')) {
    return 'Speech-to-text failed. Try Chrome, or type your question instead.';
  }
  if (decoded.includes('speech_to_text') || decoded.includes('not enabled')) {
    return 'Speech-to-text is not enabled on your Dify app (Dify → App → Features).';
  }

  return decoded.length > 160 ? `${decoded.slice(0, 160)}…` : decoded;
}
