import { ReactElement } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

type Props = {
  extensionsToShow: 'queryless';
  query: DataQuery;
};

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

export function AlertingRuleQueryExtentionPoint(props: Props): ReactElement | null {
  const { extensionsToShow, query } = props;
  // for opeining the modal
  // const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  // const [isOpen, setIsOpen] = useState<boolean>(false);
  const context = { targets: [query] };

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertingRuleQueryEditor,
    context: context,
    limitPerPlugin: 3,
  });

  // Filter queryless links if needed
  const querylessLinks = links.filter((link) => QUERYLESS_APPS.includes(link.pluginId));

  return (
    <>
      {extensionsToShow === 'queryless' && querylessLinks.length > 0 && (
        <div>
          {/* Render queryless extensions here */}
          {querylessLinks.map((link) => (
            // the links should be html links
            <a key={link.id} href={link.path}>
              {link.title}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

export type PluginExtensionAlertingRuleContext = {
  targets: DataQuery[];
};

function useExtensionPointContext(props: Props): PluginExtensionAlertingRuleContext {
  const { query } = props;
  return {
    targets: [query],
  };
}
