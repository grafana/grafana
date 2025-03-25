import { config } from '@grafana/runtime';
import { Carousel } from '@grafana/ui';

import { CatalogPlugin, Screenshots } from '../types';

const buildScreenshotPath = (plugin: CatalogPlugin, path: string) => {
  return `${config.appSubUrl}/api/gnet/plugins/${plugin.id}/versions/${plugin.latestVersion}/images/${path}`;
};

interface PluginScreenshotCarouselProps {
  plugin: CatalogPlugin;
  screenshots: Screenshots[];
}

export const PluginScreenshotCarousel: React.FC<PluginScreenshotCarouselProps> = ({ screenshots, plugin }) => {
  const carouselImages: Screenshots[] = screenshots.map((screenshot) => ({
    path: buildScreenshotPath(plugin, screenshot.path),
    name: screenshot.name,
  }));

  return <Carousel images={carouselImages} />;
};
