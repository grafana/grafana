// Libraries
import React, { PureComponent } from 'react';

// Components
import { getAngularLoader, AngularComponent } from '@grafana/runtime';
import { EditorTabBody } from './EditorTabBody';
import './../../panel/GeneralTabCtrl';

// Types
import { PanelModel } from '../state/PanelModel';
import { DataLink } from '@grafana/data';
import { PanelOptionsGroup, DataLinksEditor } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

interface Props {
  panel: PanelModel;
}

export class GeneralTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const { panel } = this.props;

    const loader = getAngularLoader();
    const template = '<panel-general-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  onDataLinksChanged = (links: DataLink[], callback?: () => void) => {
    this.props.panel.links = links;
    this.props.panel.render();
    this.forceUpdate(callback);
  };

  render() {
    const { panel } = this.props;
    const suggestions = getPanelLinksVariableSuggestions();

    return (
      <EditorTabBody heading="General" toolbarItems={[]}>
        <>
          <div ref={element => (this.element = element)} />
          <PanelOptionsGroup title="Panel links">
            <DataLinksEditor
              value={panel.links}
              onChange={this.onDataLinksChanged}
              suggestions={suggestions}
              maxLinks={10}
            />
          </PanelOptionsGroup>
        </>
      </EditorTabBody>
    );
  }
}
