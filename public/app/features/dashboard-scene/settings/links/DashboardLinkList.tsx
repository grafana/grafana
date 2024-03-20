import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';
import {
  Alert,
  Button,
  DeleteButton,
  HorizontalGroup,
  Icon,
  IconButton,
  Stack,
  TagList,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { Trans, t } from 'app/core/internationalization';

interface DashboardLinkListProps {
  links: DashboardLink[];
  onNew: () => void;
  onEdit: (idx: number) => void;
  onDuplicate: (link: DashboardLink) => void;
  onDelete: (idx: number) => void;
  onOrderChange: (idx: number, direction: number) => void;
}

export function DashboardLinkList({
  links,
  onNew,
  onOrderChange,
  onEdit,
  onDuplicate,
  onDelete,
}: DashboardLinkListProps) {
  const styles = useStyles2(getStyles);
  const isEmptyList = links.length === 0;

  if (isEmptyList) {
    return (
      <Stack direction="column">
        <EmptyState
          buttonLabel={t('dashboard-links.empty-state.button-title', 'Add dashboard link')}
          message={t('dashboard-links.empty-state.title', 'There are no dashboard links added yet')}
          onButtonClick={onNew}
        />
        <Alert severity="info" title={t('dashboard-links.empty-state.info-box-title', 'What are dashboard links?')}>
          <Trans i18nKey="dashboard-links.empty-state.info-box-content">
            Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard
            header.{' '}
            <TextLink
              external
              href="https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/manage-dashboard-links/"
            >
              Learn more
            </TextLink>
          </Trans>
        </Alert>
      </Stack>
    );
  }

  return (
    <>
      <table role="grid" className="filter-table filter-table--hover">
        <thead>
          <tr>
            <th>Type</th>
            <th>Info</th>
            <th colSpan={3} />
          </tr>
        </thead>
        <tbody>
          {links.map((link, idx) => (
            <tr key={`${link.title}-${idx}`}>
              <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                <Icon name="external-link-alt" /> &nbsp; {link.type}
              </td>
              <td role="gridcell">
                <HorizontalGroup>
                  {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
                  {link.type === 'link' && <span className={styles.urlWrapper}>{link.url}</span>}
                  {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
                </HorizontalGroup>
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                {idx !== 0 && (
                  <IconButton name="arrow-up" onClick={() => onOrderChange(idx, -1)} tooltip="Move link up" />
                )}
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                {links.length > 1 && idx !== links.length - 1 ? (
                  <IconButton name="arrow-down" onClick={() => onOrderChange(idx, 1)} tooltip="Move link down" />
                ) : null}
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                <IconButton name="copy" onClick={() => onDuplicate(link)} tooltip="Copy link" />
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                <DeleteButton
                  aria-label={`Delete link with title "${link.title}"`}
                  size="sm"
                  onConfirm={() => onDelete(idx)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button className={styles.newLinkButton} icon="plus" onClick={onNew}>
        New link
      </Button>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  titleWrapper: css({
    width: '20vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  urlWrapper: css({
    width: '40vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  newLinkButton: css({
    marginTop: theme.spacing(3),
  }),
});
