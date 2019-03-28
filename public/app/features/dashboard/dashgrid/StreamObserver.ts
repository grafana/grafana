import { SeriesData } from '@grafana/ui';
import { Subscribable, Unsubscribable, Observer } from 'rxjs';
import throttle from 'lodash/throttle';

// Update the stream and return true if we should keep streaming
export type SeriesStreamUpdate = (series: SeriesData) => boolean;

export class StreamObserver implements Observer<SeriesData> {
  refId: string;
  stream?: Subscribable<SeriesData>;
  subscription?: Unsubscribable;

  closed: boolean;

  constructor(series: SeriesData, public onUpdate: SeriesStreamUpdate) {
    if (!series.refId || !series.stream) {
      throw new Error('SeriesStreamObserver only supports series with refId and stream');
    }
    this.refId = series.refId;
    this.stream = series.stream;
    this.subscription = series.stream.subscribe(this);
  }

  unsubscribe = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.stream = null;
  };

  next = throttle((value: SeriesData) => {
    if (!this.onUpdate(value)) {
      console.log('Response was not found', this.refId);
      this.unsubscribe();
    }
  }, 100); // max 10hz

  error = (err: any) => {
    console.log('Error', this.refId, err);
  };

  complete = () => {
    console.log('Done!', this.refId);
  };
}
