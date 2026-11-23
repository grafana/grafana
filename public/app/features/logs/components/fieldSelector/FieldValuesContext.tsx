import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

import { FlagKeys } from '@grafana/runtime/internal';

import { type LogListModel } from '../panel/processing';

import { LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from './logFields';

interface FieldValuesContextData {
  collapseField(field: string): void;
  expandedFields: Set<string>;
  logs: LogListModel[];
  toggleFieldExpanded(field: string): void;
}

const FieldValuesContext = createContext<FieldValuesContextData | undefined>(undefined);

export const useFieldValuesContext = () => useContext(FieldValuesContext);

export function fieldSupportsValues(field: string) {
  return field !== LOG_LINE_BODY_FIELD_NAME && field !== OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME;
}

interface Props {
  children: ReactNode;
  logs: LogListModel[];
}

export const FieldValuesContextProvider = ({ children, logs }: Props) => {
  const enabled = useBooleanFlagValue(FlagKeys.GrafanaLogsFieldSelectorValues, false);
  return enabled ? (
    <EnabledFieldValuesContextProvider logs={logs}>{children}</EnabledFieldValuesContextProvider>
  ) : (
    children
  );
};

const EnabledFieldValuesContextProvider = ({ children, logs }: Props) => {
  const [expandedFields, setExpandedFields] = useState(new Set<string>());

  const toggleFieldExpanded = useCallback((field: string) => {
    setExpandedFields((state) => {
      const expandedFields = new Set(state);
      if (!expandedFields.delete(field)) {
        expandedFields.add(field);
      }
      return expandedFields;
    });
  }, []);

  const collapseField = useCallback((field: string) => {
    setExpandedFields((state) => new Set([...state].filter((expanded) => expanded !== field)));
  }, []);

  return (
    <FieldValuesContext.Provider value={{ collapseField, expandedFields, logs, toggleFieldExpanded }}>
      {children}
    </FieldValuesContext.Provider>
  );
};
