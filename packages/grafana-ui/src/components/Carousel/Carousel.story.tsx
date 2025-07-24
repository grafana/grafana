import { Meta, StoryFn } from '@storybook/react';

import { Carousel, CarouselProps } from './Carousel';
import mdx from './Carousel.mdx';

// Sample images for the stories
const sampleImages = [
  {
    path: 'https://grafana.com/static/img/alerting/grafana-alerting-enterprise-scale-mimir-and-loki.png/apple-touch-icon.png',
    name: 'Alert rule',
  },
  { path: 'https://grafana.com/static/img/screenshots/grafana_dash.jpeg', name: 'Dashboard' },
  { path: 'https://grafana.com/static/img/screenshots/metrics.jpg', name: 'Metrics' },
  { path: 'https://grafana.com/static/img/screenshots/traces.jpg', name: 'Traces' },
];

const meta: Meta<typeof Carousel> = {
  title: 'Overlays/Carousel',
  component: Carousel,
  parameters: {
    docs: { page: mdx },
  },
  argTypes: {
    images: {
      description: 'Array of image objects with path and name properties',
    },
  },
};

const Template: StoryFn<CarouselProps> = (args) => <Carousel {...args} />;

export const Basic = Template.bind({});
Basic.args = {
  images: sampleImages,
};

export default meta;
