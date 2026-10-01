import { PluginExtensionPoints } from '@grafana/data';
import { locationService, usePluginLinks } from '@grafana/runtime';
import { Sidebar } from '@grafana/ui';

const LINKS_LIMIT_PER_PLUGIN = 1;

/**
 * Extension point for plugins to add buttons to the dashboard sidebar.
 * Link-based so core owns the button chrome — plugins only provide title, icon and a path or onClick.
 */
export function DashboardSidebarExtensionPoint() {
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.DashboardSidebar,
    limitPerPlugin: LINKS_LIMIT_PER_PLUGIN,
  });

  return (
    <>
      {links.map((link) => (
        <Sidebar.Button
          key={link.id}
          icon={link.icon ?? 'plug'}
          title={link.title}
          tooltip={link.description || undefined}
          onClick={(e) => {
            if (link.onClick) {
              link.onClick(e);
            } else if (link.path) {
              locationService.push(link.path);
            }
          }}
        />
      ))}
    </>
  );
}
