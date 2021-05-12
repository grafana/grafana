let value = 1;

export async function increment(): Promise<string> {
  value++;
  console.log('worker increment', value);
  return `VALUE ${value}!`;
}

export async function greet(subject: string): Promise<string> {
  console.log('worker greet', subject);
  return `Hello, ${subject}!`;
}

// export interface LiveWorkerIFace {
//   increment: () => void;

//   // Tip: async functions make the interface identical
//   getValue: () => Promise<number>;
// }

// export class LiveWorker {
//   value = Math.floor(Math.random() * 10000);

//   constructor() {}

//   increment() {
//     this.value++;
//   }

//   // Tip: async functions make the interface identical
//   async getValue() {
//     return this.value;
//   }
// }

// const inst = new LiveWorker();
// Comlink.expose(inst);
