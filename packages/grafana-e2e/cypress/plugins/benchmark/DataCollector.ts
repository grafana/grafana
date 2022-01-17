export type CollectedData = Record<string, unknown>;

export enum DataCollectorName {
  CDP = 'CDP',
}

type DataCollectorRequest = { id: string };

export type DataCollector<T extends CollectedData = CollectedData> = {
  start: (input: DataCollectorRequest) => Promise<void>;
  stop: (input: DataCollectorRequest) => Promise<T>;
  getName: () => DataCollectorName;
  close: () => Promise<void>;
};
