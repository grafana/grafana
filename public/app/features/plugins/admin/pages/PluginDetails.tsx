import React from 'react';
import { useParams } from 'react-router-dom';

import { PluginDetailsPage } from '../components/PluginDetailsPage';

export default function PluginDetails(): JSX.Element {
  const { pluginId } = useParams<{ pluginId: string }>();

  return <PluginDetailsPage pluginId={pluginId} />;
}
