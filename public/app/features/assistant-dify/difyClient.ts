import { getBackendSrv } from '@grafana/runtime';

export interface DifyChatResult {
  answer: string;
  conversationId: string;
}

const PROXY_BASE = 'http://localhost:3456';

interface DifyChatResponse {
  answer?: string;
  conversation_id?: string;
  message?: string;
}

interface DifyAudioResponse {
  text?: string;
  message?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await fetch(`${PROXY_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: T & DifyAudioResponse = await res.json();
    if (!res.ok) {
      throw new Error((data as DifyAudioResponse).message || `Dify proxy error ${res.status}`);
    }
    return data;
  } catch (proxyErr) {
    try {
      return await getBackendSrv().post(`/api/assistant-dify${path}`, body);
    } catch {
      throw proxyErr;
    }
  }
}

export async function sendDifyChatMessage(
  query: string,
  conversationId: string,
  user: string
): Promise<DifyChatResult> {
  const data = await postJson<DifyChatResponse>('/chat-messages', {
    query,
    conversation_id: conversationId || undefined,
    user,
    response_mode: 'blocking',
    inputs: {},
  });

  if (!data.answer) {
    throw new Error(data.message || 'Empty answer from Dify');
  }

  return {
    answer: data.answer,
    conversationId: data.conversation_id || conversationId,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });
}

function mimeToFilename(mimeType: string): string {
  if (mimeType.includes('mp4')) {
    return 'recording.m4a';
  }
  if (mimeType.includes('webm')) {
    return 'recording.webm';
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return 'recording.mp3';
  }
  return 'recording.wav';
}

/** Send audio to Dify speech-to-text via proxy (JSON base64 — avoids multipart corruption). */
export async function transcribeAudioWithDify(audioBlob: Blob, user: string): Promise<string> {
  const mimeType = audioBlob.type || 'audio/wav';
  const audioBase64 = await blobToBase64(audioBlob);

  const data = await postJson<DifyAudioResponse>('/audio-to-text', {
    user,
    audioBase64,
    mimeType,
    filename: mimeToFilename(mimeType),
  });

  if (!data.text) {
    throw new Error(data.message || 'Empty transcription from Dify');
  }
  return data.text;
}
