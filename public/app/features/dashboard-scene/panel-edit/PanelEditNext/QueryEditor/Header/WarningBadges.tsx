import { css } from '@emotion/css';
import { filter, uniqBy } from 'lodash';
import pluralize from 'pluralize';
import { useMemo } from 'react';

import { GrafanaTheme2, QueryResultMetaNotice } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Badge, useStyles2 } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

type SeverityType = 'warning' | 'info';

interface SeverityGroup {
  type: SeverityType;
  notices: QueryResultMetaNotice[];
}

interface SeverityBadgeProps {
  type: SeverityType;
  notices: QueryResultMetaNotice[];
}

function SeverityBadge({ type, notices }: SeverityBadgeProps) {
  const styles = useStyles2(getStyles);

  const color = type === 'warning' ? 'orange' : 'blue';
  const icon = type === 'warning' ? 'exclamation-triangle' : 'file-landscape-alt';

  return (
    <Badge
      color={color}
      icon={icon}
      text={
        <Trans
          i18nKey="query-editor.header.warning-badges.text"
          values={{ count: notices.length, type: pluralize(type, notices.length) }}
        >
          {'{{count}} {{type}}'}
        </Trans>
      }
      tooltip={
        <ul className={styles.noticeList}>
          {notices.map(({ text }, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      }
    />
  );
}

export function WarningBadges() {
  const { data } = useQueryRunnerContext();
  const { selectedQuery, cardType } = useQueryEditorUIContext();
  const queryRefId = selectedQuery?.refId;

  const severityGroups = useMemo<SeverityGroup[]>(() => {
    if (!data || !queryRefId) {
      return [];
    }

    const dataFilteredByRefId = filterPanelDataToQuery(data, queryRefId)?.series ?? [];

    // Collect notices grouped by severity type
    const groups: SeverityGroup[] = [];
    const severityTypes: SeverityType[] = ['warning', 'info'];

    severityTypes.forEach((type) => {
      const allNotices = dataFilteredByRefId.reduce((acc: QueryResultMetaNotice[], series) => {
        if (!series.meta?.notices) {
          return acc;
        }

        const notices = filter(series.meta.notices, (item: QueryResultMetaNotice) => item.severity === type);
        return acc.concat(notices);
      }, []);

      const uniqueNotices = uniqBy(allNotices, 'text');

      if (uniqueNotices.length > 0) {
        groups.push({ type, notices: uniqueNotices });
      }
    });

    return groups;
  }, [data, queryRefId]);

  if (cardType === QueryEditorType.Transformation) {
    return null;
  }

  if (severityGroups.length === 0) {
    return null;
  }

  return severityGroups.map(({ type, notices }) => <SeverityBadge key={type} type={type} notices={notices} />);
}

const getStyles = (theme: GrafanaTheme2) => ({
  noticeList: css({
    margin: 0,
    paddingLeft: theme.spacing(2),
  }),
});
