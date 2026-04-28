import { css } from '@emotion/css';

import { type DashboardLink } from '@grafana/schema';
import { Icon, Stack, TagList } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { ProvisionedControlsSection, SourceIcon } from '../ProvisionedControlsSection';

const LINK_COLUMNS = [
  { i18nKey: 'dashboard-scene.dashboard-link-list.type', defaultText: 'Type' },
  { i18nKey: 'dashboard-scene.dashboard-link-list.info', defaultText: 'Info' },
];

export function ProvisionedLinksSection({ links }: { links: DashboardLink[] }) {
  const styles = useStyles2(getStyles);

  return (
    <ProvisionedControlsSection columns={LINK_COLUMNS}>
      {links.map((link, index) => (
        <tr key={`${link.title}-${index}`}>
          <td role="gridcell">
            <Icon name="external-link-alt" /> &nbsp; {link.type}
          </td>
          <td role="gridcell">
            <Stack>
              {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
              {link.type === 'link' && <span className={styles.urlWrapper}>{link.url}</span>}
              {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
            </Stack>
          </td>
          <td role="gridcell" className={styles.sourceCell}>
            <SourceIcon origin={link.origin} />
          </td>
        </tr>
      ))}
    </ProvisionedControlsSection>
  );
}

const getStyles = () => ({
  titleWrapper: css({
    width: '20vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  }),
  urlWrapper: css({
    width: '40vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  }),
  sourceCell: css({
    width: '1%',
    textAlign: 'center' as const,
  }),
});
