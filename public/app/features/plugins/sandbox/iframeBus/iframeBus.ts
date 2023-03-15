import { v4 as uuidv4 } from 'uuid';

export type IframeBusWrapper<M> = {
  id: string;
  message: M;
  error?: Error;
};

type IframeBusOutgoingMessage<M> = {
  resolve: (value: M | PromiseLike<M>) => void;
  reject: (error: Error) => void;
  timestamp: number;
};

export class IFrameBus<M> {
  private port: MessagePort;
  private outgoingMessages: Record<string, IframeBusOutgoingMessage<M>> = {};
  private externalOnMessage: (message: M) => Promise<M>;

  TIMEOUT_LIMIT = 10000;

  constructor({ port, onMessage }: { port: MessagePort; onMessage: (message: M) => Promise<M> }) {
    this.port = port;
    this.port.onmessage = this.onMessage.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.postMessage = this.postMessage.bind(this);
    this.externalOnMessage = onMessage;
    setInterval(this.checkForTimeouts.bind(this), 1000);
  }

  private checkForTimeouts() {
    const now = Date.now();
    for (const [key, value] of Object.entries(this.outgoingMessages)) {
      if (now - value.timestamp > this.TIMEOUT_LIMIT) {
        value.reject(new Error('Timeout'));
        delete this.outgoingMessages[key];
      }
    }
  }

  private async onMessage(event: MessageEvent<IframeBusWrapper<M>>) {
    const messageWrapper: IframeBusWrapper<M> = event.data;

    // check if this is a response to a message we sent
    const outgoingMessage = this.outgoingMessages[messageWrapper.id];
    if (outgoingMessage) {
      delete this.outgoingMessages[messageWrapper.id];

      // handle error cases
      if (messageWrapper.error) {
        outgoingMessage.reject(messageWrapper.error);
        return;
      }
      outgoingMessage.resolve(messageWrapper.message);
      return;
    }

    try {
      // not a response, so it must be a message we received and might need to respond
      const response = await this.externalOnMessage(messageWrapper.message);

      // if we don't have a response, we are done
      if (response === undefined) {
        return;
      }

      // otherwise, send the response
      const responseWrapper: IframeBusWrapper<M> = {
        id: messageWrapper.id,
        message: response,
      };
      this.port.postMessage(responseWrapper);
    } catch (err) {
      // if we get an error, send it back
      this.port.postMessage({
        id: messageWrapper.id,
        error: err,
      });
    }
  }

  async postMessage(message: M): Promise<M> {
    return new Promise<M>((resolve, reject) => {
      const uid = uuidv4();

      const wrappedMessage: IframeBusWrapper<M> = {
        id: uid,
        message,
      };

      this.outgoingMessages[uid] = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.port.postMessage(wrappedMessage);
    });
  }
}
