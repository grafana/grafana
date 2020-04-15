import { JSON_STREAM_DONE } from '../consts';

export class MockWorker {
  mockData: any;
  onmessage: (arg: any) => void;

  constructor(mockData: any) {
    this.mockData = mockData;
  }

  postMessage = jest.fn(function(this: any) {
    this.onmessage({ data: this.mockData });
    this.onmessage({ data: JSON_STREAM_DONE });
  });

  terminate() {}
}
