import React, { PureComponent } from 'react';

import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { PanelPluginMeta } from '@grafana/data';
import { Icon } from '@grafana/ui';

interface Props {
  plugin: PanelPluginMeta;
  searchQuery: string;
  onChange: (query: string) => void;
  onClose: () => void;
}

export class VizPickerSearch extends PureComponent<Props> {
  render() {
    const { searchQuery, onChange, onClose } = this.props;
    return (
      <>
        <FilterInput placeholder="" onChange={onChange} value={searchQuery} />
        <button className="btn btn-link toolbar__close" onClick={onClose}>
          <Icon name="angle-up" />
        </button>
      </>
    );
  }
}
