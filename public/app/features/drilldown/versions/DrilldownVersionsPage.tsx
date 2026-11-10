import { css } from '@emotion/css';
import { Suspense, forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, LoadingPlaceholder, Menu, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { type DrilldownVersion, getDrilldownVersions } from './versions';

// The tab bar sits in a plain container instead of a second Page, because every version renders its own Page
// with its own header and scroll container.
export function DrilldownVersionsPage() {
  const styles = useStyles2(getStyles);
  const [queryParams, updateQueryParams] = useQueryParams();

  const versions = getDrilldownVersions();
  const active = versions.find((version) => version.id === queryParams.version) ?? versions[0];
  const activeView = active.views.find((view) => view.id === queryParams.view) ?? active.views[0];
  const ActiveView = activeView.component;

  // The home view is the default, so it leaves no view in the URL.
  const open = (version: DrilldownVersion, viewId: string) =>
    updateQueryParams({ version: version.id, view: viewId === version.views[0].id ? null : viewId });

  return (
    <div className={styles.container}>
      <TabsBar className={styles.tabs}>
        {versions.map((version) =>
          version.views.length > 1 ? (
            <Dropdown
              key={version.id}
              placement="bottom-start"
              overlay={
                <Menu>
                  {version.views.map((view) => (
                    <Menu.Item
                      key={view.id}
                      label={view.label}
                      active={version.id === active.id && view.id === activeView.id}
                      onClick={() => open(version, view.id)}
                    />
                  ))}
                </Menu>
              }
            >
              <GroupTab
                label={
                  version.id === active.id && activeView.id !== version.views[0].id
                    ? `${version.label}: ${activeView.label}`
                    : version.label
                }
                active={version.id === active.id}
              />
            </Dropdown>
          ) : (
            <Tab
              key={version.id}
              label={version.label}
              active={version.id === active.id}
              onChangeTab={() => open(version, version.views[0].id)}
            />
          )
        )}
      </TabsBar>
      <Suspense fallback={<LoadingPlaceholder text="" />}>
        <ActiveView key={`${active.id}-${activeView.id}`} />
      </Suspense>
    </div>
  );
}

function ChevronSuffix({ className }: { className?: string }) {
  return <Icon name="angle-down" className={className} />;
}

// Tab overrides the click handler a Dropdown trigger needs, so the tab sits inside a span that carries the
// trigger's ref and click handler. Clicks on the tab bubble up to it.
const GroupTab = forwardRef<HTMLSpanElement, { label: string; active: boolean }>(function GroupTab(
  { label, active, ...triggerProps },
  ref
) {
  const styles = useStyles2(getStyles);
  return (
    <span ref={ref} className={styles.trigger} {...triggerProps}>
      <Tab label={label} active={active} suffix={ChevronSuffix} />
    </span>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flex: '1 1 0',
    flexDirection: 'column',
  }),
  tabs: css({
    padding: theme.spacing(0, 2),
  }),
  trigger: css({
    display: 'inline-flex',
  }),
});

export default DrilldownVersionsPage;
