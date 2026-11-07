import { type Slideshow } from '@grafana/api-clients/rtkq/collections/v1alpha1';

export type SlideshowItemDraft = Slideshow['spec']['items'][number];
