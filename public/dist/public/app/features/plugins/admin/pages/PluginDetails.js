import React from 'react';
import { useParams } from 'react-router-dom';
import { PluginDetailsPage } from '../components/PluginDetailsPage';
export default function PluginDetails() {
    const { pluginId } = useParams();
    return React.createElement(PluginDetailsPage, { pluginId: pluginId });
}
//# sourceMappingURL=PluginDetails.js.map