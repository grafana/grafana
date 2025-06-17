import { PrometheusDatasource } from '../../../../datasource';
import { PromVisualQuery } from '../../../types';

export interface MetricsModalState {
  useBackend: boolean;
  disableTextWrap: boolean;
  includeNullMetadata: boolean;
  fullMetaSearch: boolean;
  hasMetadata: boolean;
}

export interface MetricsModalProps {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
  initialMetrics: string[] | (() => Promise<string[]>);
}

export interface AdditionalSettingsProps {
  state: MetricsModalState;
  onChangeFullMetaSearch: () => void;
  onChangeIncludeNullMetadata: () => void;
  onChangeDisableTextWrap: () => void;
  onChangeUseBackend: () => void;
}
