import { useParams } from 'react-router-dom-v5-compat';

import { PluginDetailsPage } from '../components/PluginDetailsPage';

export default function PluginDetails(): JSX.Element {
  const { pluginId = '' } = useParams<{ pluginId: string }>();

  return <PluginDetailsPage pluginId={pluginId} />;
}
