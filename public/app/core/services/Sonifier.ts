export type Note = 'A' | 'Bb' | 'B' | 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'Gb' | 'G' | 'Ab';

const A4_FREQUENCY = 440;

const SemitoneMapping: { [note: string]: number } = {
  A: 0,
  Bb: 1,
  B: 2,
  C: 3,
  Dd: 4,
  D: 5,
  Eb: 6,
  E: 7,
  F: 8,
  Gb: 9,
  G: 10,
  Ab: 11,
};

type Scale = number[];
type ScaleType = 'major' | 'minor' | 'chromatic';
type ProcessFn = (() => void) | undefined;
type SampleFrame<T> = {
  data: T;
  index: number;
};
type PlaySeriesOptions = {
  min?: number;
  max?: number;
  onPointProcess?: (pointIndex: number) => void;
};

const Scales: { [name in 'major' | 'minor' | 'chromatic']: Scale } = {
  chromatic: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  major: [2, 2, 1, 2, 2, 2, 1, 2],
  minor: [2, 1, 2, 2, 1, 3, 1, 2],
};

export type Tuple = [ts: number, val: number];
type SamplingMethod = 'random' | 'systematic';

type SonifierOptions = {
  baseFrequency?: number;
  scales?: number;
  maxSamples?: number;
  samplingMethod?: SamplingMethod;
  instrument?: OscillatorType;
  scale?: ScaleType;
  volume?: number;
  fixedDeltaTime: boolean;
};

export class Sonifier {
  isPlaying: boolean;
  baseFrequency: number;
  scales: number;
  maxSamples: number;
  samplingMethod: SamplingMethod;
  instrument: OscillatorType;
  scale: ScaleType;

  private _audioContext: AudioContext;
  private _volume: number;
  private _paused: boolean;
  private _fixedDt: boolean;
  private _playQueue: Array<{ data: Tuple; duration: number; onProcess: ProcessFn }>;

  constructor(options?: SonifierOptions) {
    this.isPlaying = false;
    this.baseFrequency = options?.baseFrequency || A4_FREQUENCY;
    this.scales = options?.scales || 3;
    this.maxSamples = options?.maxSamples || 50;
    this.samplingMethod = options?.samplingMethod || 'systematic';
    this.instrument = options?.instrument || 'square';
    this.scale = options?.scale || 'chromatic';

    this._volume = options?.volume || 0.03;
    this._fixedDt = options?.fixedDeltaTime || false;
    this._playQueue = [];
    this._paused = false;
    this._audioContext = new AudioContext();
  }

  private _advancePlayQueue(): void {
    if (this._playQueue.length === 0) {
      return;
    }
    const {
      data: [t, f],
      duration = 200,
      onProcess,
    } = this._playQueue.shift() as { data: Tuple; duration: number; onProcess: ProcessFn };

    const oscilator = this._audioContext.createOscillator();
    oscilator.type = this.instrument;
    oscilator.onended = () => {
      onProcess && onProcess();
      if (this._playQueue.length > 0 && !this._paused) {
        this._advancePlayQueue();
      } else {
        this.isPlaying = false;
      }
    };
    const gainNode = this._audioContext.createGain();
    gainNode.gain.value = this._volume;
    oscilator.connect(gainNode);
    gainNode.connect(this._audioContext.destination);
    oscilator.frequency.value = f;

    oscilator.start(t);
    oscilator.stop(t + duration * 0.001);
    this.isPlaying = true;
  }

  private _enqueueNote({ f, ts, duration }: { f: number; ts: number; duration: number }, onProcess?: () => void): void {
    this._playQueue.push({ data: [ts, f], duration, onProcess });
    if (!this.isPlaying) {
      this._advancePlayQueue();
    }
  }

  private _harmonizeFrequencies(
    data: Array<SampleFrame<Tuple>>,
    options?: PlaySeriesOptions
  ): Array<SampleFrame<Tuple>> {
    let harmonizedData: Array<SampleFrame<Tuple>> = [];

    const sortedByValue = [...data].sort((a, b) => a.data[1] - b.data[1]);

    let min = options?.min || sortedByValue[0].data[1];
    let max = options?.max || sortedByValue[sortedByValue.length - 1].data[1];

    let minT = data[0].data[0];
    let maxT = data[data.length - 1].data[0];

    let maxHarmonicIndex = this.scales * Scales[this.scale].length;

    let dt = 1 / data.length;

    for (let i = 0; i < sortedByValue.length; i++) {
      const mappedIndex = Math.floor(((sortedByValue[i].data[1] - min) / (max - min)) * maxHarmonicIndex);

      const f = this.baseFrequency * Math.pow(2, mappedIndex / 12);
      if (!this._fixedDt) {
        dt = (sortedByValue[i].data[0] - minT) / (maxT - minT);
      }

      harmonizedData.push({
        index: sortedByValue[i].index,
        data: [dt, f],
      });
    }

    return [...harmonizedData].sort((a, b) => a.data[0] - b.data[0]);
  }

  private _sample(data: Tuple[]): Array<SampleFrame<Tuple>> {
    const sample = [];

    let step = data.length >= this.maxSamples ? Math.floor(data.length / this.maxSamples) : 1;
    if (step === 1) {
      return data.map((x, index) => ({
        data: x,
        index,
      }));
    }

    let i = step;

    while (i < data.length) {
      let index;
      switch (this.samplingMethod) {
        case 'random': {
          index = i - Math.floor(Math.random() * step);
          break;
        }
        case 'systematic': {
          index = i - step;
          break;
        }
        default: {
          index = i;
          break;
        }
      }

      sample.push({
        data: data[index][1] !== null ? data[index] : ([data[index][0], 0] as Tuple),
        index,
      });

      i += step;
    }

    return sample;
  }

  getInstruments(): OscillatorType[] {
    return ['sine', 'square', 'triangle', 'sawtooth'];
  }

  getInstrument(): OscillatorType {
    return this.instrument;
  }

  setInstrument(instrument: OscillatorType) {
    this.instrument = instrument;
  }

  pause() {
    this._paused = true;
  }

  stop() {
    this.pause();
    this._playQueue = [];
  }

  play() {
    this._paused = false;
    this._advancePlayQueue();
  }

  setVolume(volume: number) {
    this._volume = volume;
  }

  getVolume(): number {
    return this._volume;
  }

  playNote(note: string, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const semitones = SemitoneMapping[note as string];
      const f = this.baseFrequency * Math.pow(2, semitones / 12);
      let start = this._audioContext.currentTime + 0.02;
      this._enqueueNote({ f, ts: start, duration }, resolve);
    });
  }

  playSeries(data: Tuple[], options?: PlaySeriesOptions): Promise<void> {
    return new Promise((resolve) => {
      if (data.length === 0) {
        return;
      }

      const sampledData = this._sample(data);
      const harmonizedData = this._harmonizeFrequencies(sampledData, options);

      let start = this._audioContext.currentTime + 0.02;

      const duration = harmonizedData.length * 0.4;

      for (let i = 0; i < harmonizedData.length; ++i) {
        const [dt, f] = harmonizedData[i].data;

        if (i === harmonizedData.length - 1) {
          this._enqueueNote(
            {
              f,
              ts: start + dt * duration,
              duration: 200,
            },
            () => {
              options?.onPointProcess?.(harmonizedData[i].index);
              resolve();
            }
          );
        } else {
          this._enqueueNote(
            {
              f,
              ts: start + dt * duration,
              duration: 200,
            },
            () => {
              options?.onPointProcess?.(harmonizedData[i].index);
            }
          );
        }
      }
    });
  }

  speak(text: string): Promise<SpeechSynthesisEvent> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => reject(event.error);

      speechSynthesis.speak(utterance);
    });
  }
}

// Singleton
export const sonifier = new Sonifier();
export const getSonifier = (): Sonifier => sonifier;
export default getSonifier;
