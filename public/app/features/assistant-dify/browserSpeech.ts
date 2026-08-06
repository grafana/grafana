/**
 * Browser speech recognition — primary voice path (same as most web chat UIs).
 * Dify speech-to-text API is used only when the browser cannot transcribe locally.
 */
export function isBrowserSpeechAvailable(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

export class BrowserSpeechCapture {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private finalText = '';
  private latestInterim = '';

  start(): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      return false;
    }

    this.finalText = '';
    this.latestInterim = '';
    this.recognition = new Ctor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onresult = (event: {
      resultIndex: number;
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
    }) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const part = result[0]?.transcript ?? '';
        if (result.isFinal) {
          this.finalText += part;
          this.latestInterim = '';
        } else {
          this.latestInterim = part;
        }
      }
    };

    this.recognition.onerror = () => {
      // Audio fallback may still work.
    };

    try {
      this.recognition.start();
      return true;
    } catch {
      this.recognition = null;
      return false;
    }
  }

  stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        resolve('');
        return;
      }

      const recognition = this.recognition;
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.recognition = null;
        resolve((this.finalText + this.latestInterim).trim());
        this.finalText = '';
        this.latestInterim = '';
      };

      recognition.onend = finish;
      recognition.onerror = finish;

      try {
        recognition.stop();
      } catch {
        finish();
      }

      // Safety timeout if onend never fires.
      setTimeout(finish, 1500);
    });
  }

  cancel(): void {
    try {
      this.recognition?.abort();
    } catch {
      // ignore
    }
    this.recognition = null;
    this.finalText = '';
    this.latestInterim = '';
  }
}

function getSpeechRecognitionCtor(): (new () => unknown) | undefined {
  const w = window as Window & {
    SpeechRecognition?: new () => unknown;
    webkitSpeechRecognition?: new () => unknown;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
