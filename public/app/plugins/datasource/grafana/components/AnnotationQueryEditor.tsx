import { css } from '@emotion/css';
import { useMemo } from 'react';
import * as React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, FieldSet, Select, Switch, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { t, Trans } from 'app/core/internationalization';
import { TimeRegionConfig } from 'app/core/utils/timeRegions';
import { getAnnotationTags } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery, GrafanaQueryType } from '../types';

import { TimeRegionEditor } from './TimeRegionEditor';

/*BMC Change: To enable localization for below text*/
const matchTooltipContent = () => {
  return t(
    'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.match-any-desc',
    'Enabling this returns annotations that match any of the tags specified below'
  );
};

/*BMC Change: To enable localization for below text*/
const tagsTooltipContent = () => {
  return (
    <Trans i18nKey={'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.tag-field-desc'}>
      <div>Specify a list of tags to match. To specify a key and value tag use `key:value` syntax.</div>
    </Trans>
  );
};

/*BMC Change: To enable localization for below text*/
const annotationTypes = (): Array<SelectableValue<GrafanaAnnotationType>> => {
  return [
    {
      label: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by.dashboard-label',
        'Dashboard'
      ),
      value: GrafanaAnnotationType.Dashboard,
      description: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by.dashboard-desc',
        'Query for events created on this dashboard and show them in the panels where they where created'
      ),
    },
    {
      label: t('bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by.tags-label', 'Tags'),
      value: GrafanaAnnotationType.Tags,
      description: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by.tags-desc',
        'This will fetch any annotation events that match the tags filter'
      ),
    },
  ];
};

/*BMC Change: To enable localization for below text*/
const queryTypes = (): Array<SelectableValue<GrafanaQueryType>> => {
  return [
    {
      label: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.query-type.annotation-label',
        'Annotations & Alerts'
      ),
      value: GrafanaQueryType.Annotations,
      description: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.query-type.annotation-desc',
        'Show annotations or alerts managed by grafana'
      ),
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.query-type.time-region-label',
        'Time regions'
      ),
      value: GrafanaQueryType.TimeRegions,
      description: t(
        'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.query-type.time-region-desc',
        'Configure a repeating time region'
      ),
    },
  ];
};

const limitOptions = [10, 50, 100, 200, 300, 500, 1000, 2000].map((limit) => ({
  label: String(limit),
  value: limit,
}));

interface Props {
  query: GrafanaQuery;
  onChange: (newValue: GrafanaAnnotationQuery) => void;
}

export default function AnnotationQueryEditor({ query, onChange }: Props) {
  const annotationQuery = query as GrafanaAnnotationQuery;
  const { limit, matchAny, tags, type, queryType } = annotationQuery;
  let grafanaQueryType = queryType ?? GrafanaQueryType.Annotations;
  const defaultTimezone = useMemo(() => getDashboardSrv().dashboard?.getTimezone(), []);
  const styles = useStyles2(getStyles);

  /*BMC Change: To enable localization for below text*/
  const queryTypesMemo = useMemo(queryTypes, []);
  const annotationTypesMemo = useMemo(annotationTypes, []);
  const matchTooltipContentMemo = useMemo(matchTooltipContent, []);
  const tagsTooltipContentMemo = useMemo(tagsTooltipContent, []);

  const onFilterByChange = (newValue: SelectableValue<GrafanaAnnotationType>) =>
    onChange({
      ...annotationQuery,
      type: newValue.value!,
    });

  const onMaxLimitChange = (newValue: SelectableValue<number>) =>
    onChange({
      ...annotationQuery,
      limit: newValue.value!,
    });

  const onMatchAnyChange = (newValue: React.ChangeEvent<HTMLInputElement>) =>
    onChange({
      ...annotationQuery,
      matchAny: newValue.target.checked,
    });

  const onTagsChange = (tags: string[]) =>
    onChange({
      ...annotationQuery,
      tags,
    });

  const onQueryTypeChange = (newValue: SelectableValue<GrafanaQueryType>) => {
    const newQuery: GrafanaAnnotationQuery = { ...annotationQuery, queryType: newValue.value! };
    if (newQuery.queryType === GrafanaQueryType.TimeRegions) {
      if (!newQuery.timeRegion) {
        newQuery.timeRegion = {
          timezone: defaultTimezone,
        };
      }
    } else {
      delete newQuery.timeRegion;
    }

    onChange(newQuery);
  };
  const onTimeRegionChange = (timeRegion?: TimeRegionConfig) => {
    onChange({
      ...annotationQuery,
      timeRegion,
    });
  };

  return (
    <FieldSet className={styles.container}>
      {/*BMC Change: To enable localization for below text*/}
      <Field
        label={t('bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.query-type-label', 'Query type')}
      >
        <Select
          inputId="grafana-annotations__query-type"
          options={queryTypesMemo}
          value={grafanaQueryType}
          onChange={onQueryTypeChange}
        />
      </Field>
      {grafanaQueryType === GrafanaQueryType.Annotations && (
        <>
          {/*BMC Change: To enable localization for below text*/}
          <Field
            label={t('bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by-label', 'Filter by')}
          >
            <Select
              inputId="grafana-annotations__filter-by"
              options={annotationTypesMemo}
              value={type}
              onChange={onFilterByChange}
            />
          </Field>
          {/*BMC Change: To enable localization for below text*/}
          <Field
            label={t('bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.max-limit-label', 'Max limit')}
          >
            <Select
              inputId="grafana-annotations__limit"
              width={16}
              options={limitOptions}
              value={limit}
              onChange={onMaxLimitChange}
            />
          </Field>
          {/*BMC Change: To enable localization for below text*/}
          {type === GrafanaAnnotationType.Tags && (
            <>
              <Field
                label={t(
                  'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.match-any-label',
                  'Match any'
                )}
                description={matchTooltipContentMemo}
              >
                <Switch id="grafana-annotations__match-any" value={matchAny} onChange={onMatchAnyChange} />
              </Field>
              <Field
                label={t(
                  'bmcgrafana.dashboards.settings.annotation.edit-form.query-editor.filter-by.tags-label',
                  'Tags'
                )}
                description={tagsTooltipContentMemo}
              >
                <TagFilter
                  allowCustomValue
                  inputId="grafana-annotations__tags"
                  onChange={onTagsChange}
                  tagOptions={getAnnotationTags}
                  tags={tags ?? []}
                />
              </Field>
            </>
          )}
        </>
      )}
      {grafanaQueryType === GrafanaQueryType.TimeRegions && annotationQuery.timeRegion && (
        <TimeRegionEditor value={annotationQuery.timeRegion} onChange={onTimeRegionChange} />
      )}
    </FieldSet>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      maxWidth: theme.spacing(60),
      marginBottom: theme.spacing(2),
    }),
  };
};
