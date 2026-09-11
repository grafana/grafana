import { useMemo } from 'react';

import { DataFrameType, type GrafanaTheme2, type TimeRange } from '@grafana/data';

import { type FieldDef, createLogLineLinks } from '../logParser';
import { groupOTelAttributes, type GroupedOTelAttributes } from '../otel/details';
import { useAttributesExtensionLinks } from '../useAttributesExtensionLinks';

import { type LabelWithLinks } from './LogLineDetailsFields';
import { getTempoTraceFromLinks } from './links';
import { type LogListModel } from './processing';

interface LogLineDetailsOTelComponentProps {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsOTelComponent = ({
  log,
  //logs,
  //prettifyDetailsJSON,
  //search = '',
  setPrettifyDetailsJSON,
  timeRange,
  //timeZone,
}: LogLineDetailsOTelComponentProps) => {
  const extensionLinks = useAttributesExtensionLinks(log, timeRange);

  const fieldsWithLinks = useMemo(() => {
    const fieldsWithLinks = log.fields.filter((f) => f.links?.length);
    const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== log.entryFieldIndex);
    const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === log.entryFieldIndex);
    const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
    return {
      links: displayedFieldsWithLinks,
      linksFromVariableMap: fieldsWithLinksFromVariableMap,
    };
  }, [log.entryFieldIndex, log.fields]);

  const fieldsWithoutLinks = useMemo(
    () =>
      log.dataFrame.meta?.type === DataFrameType.LogLines
        ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
          []
        : // for other frames, do not show the log message unless there is a link attached
          log.fields.filter((f) => f.links?.length === 0 && f.fieldIndex !== log.entryFieldIndex).sort(),
    [log.dataFrame.meta?.type, log.entryFieldIndex, log.fields]
  );

  const labelsWithLinks: LabelWithLinks[] = useMemo(
    () =>
      Object.keys(log.labels)
        .sort()
        .map((label) => ({
          key: label,
          value: log.labels[label],
          links: extensionLinks?.[label],
        })),
    [extensionLinks, log.labels]
  );

  const trace = useMemo(() => getTempoTraceFromLinks(fieldsWithLinks.links), [fieldsWithLinks.links]);

  const allLinks = useMemo(
    () => [...fieldsWithLinks.links, ...fieldsWithLinks.linksFromVariableMap],
    [fieldsWithLinks.links, fieldsWithLinks.linksFromVariableMap]
  );

  // Datasources expose attributes as either dataframe fields or labels, not both.
  const groupedAttributes = useMemo(
    () =>
      fieldsWithoutLinks.length > 0
        ? groupOTelAttributes(fieldsWithoutLinks, (field) => field.keys[0] ?? '')
        : groupOTelAttributes(labelsWithLinks, (label) => label.key),
    [fieldsWithoutLinks, labelsWithLinks]
  );

  return <LogLineDetailsOTelComponentBody groupedAttributes={groupedAttributes} />;
};

interface LogLineDetailsOTelComponentBodyProps {
  groupedAttributes: Array<GroupedOTelAttributes<FieldDef>> | Array<GroupedOTelAttributes<LabelWithLinks>>;
}

const LogLineDetailsOTelComponentBody = ({
  groupedAttributes: _groupedAttributes,
}: LogLineDetailsOTelComponentBodyProps) => {
  return <div>Todo</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({});
