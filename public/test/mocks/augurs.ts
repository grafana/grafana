import type {
  LoadedOutlierDetector as AugursLoadedOutlierDetector,
  OutlierDetector as AugursOutlierDetector,
  OutlierDetectorOptions,
  OutlierOutput,
} from '@bsull/augurs';

export default function init() {}

const dummyOutliers: OutlierOutput = {
  outlyingSeries: [],
  clusterBand: { min: [], max: [] },
  seriesResults: [],
};

export class OutlierDetector implements AugursOutlierDetector {
  free(): void {}
  detect(): OutlierOutput {
    return dummyOutliers;
  }
  preprocess(y: Float64Array, nTimestamps: number): AugursLoadedOutlierDetector {
    return new LoadedOutlierDetector();
  }
}

export class LoadedOutlierDetector implements AugursLoadedOutlierDetector {
  detect(): OutlierOutput {
    return dummyOutliers;
  }
  free(): void {}
  updateDetector(options: OutlierDetectorOptions): void {}
}
