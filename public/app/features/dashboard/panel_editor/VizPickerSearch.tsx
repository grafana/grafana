import React, { PureComponent } from 'react';

import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { PanelPluginMeta } from '@grafana/data';

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
          <i className="fa fa-chevron-up" />
        </button>
      </>
    );
  }
}
