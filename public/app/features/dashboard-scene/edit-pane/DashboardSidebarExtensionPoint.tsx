import { PluginExtensionPoints } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Sidebar } from '@grafana/ui';
import { usePluginLinks } from 'app/features/plugins/extensions/usePluginLinks';

export interface DashboardSidebarExtensionPointProps {
  dashboardUid?: string;
}

/**
 * Extension point for plugins to add buttons to the dashboard sidebar.
 * Link-based so core owns the button chrome — plugins only provide title, icon and a path or onClick.
 */
export function DashboardSidebarExtensionPoint({ dashboardUid }: DashboardSidebarExtensionPointProps) {
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.DashboardSidebar,
    context: { dashboardUid },
  });

  return (
    <>
      {links.map((link) => (
        <Sidebar.Button
          key={link.id}
          icon={link.icon ?? 'plug'}
          title={link.title}
          tooltip={link.description}
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
