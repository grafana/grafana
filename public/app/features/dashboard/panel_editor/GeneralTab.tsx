// Libraries
import React, { PureComponent } from 'react';

// Components
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';
import { PanelLinksEditor } from '../../panel/PanelLinksEditor/PanelLinksEditor';
import './../../panel/GeneralTabCtrl';

// Types
import { PanelModel } from '../state/PanelModel';
import { PanelDrillDownLink } from '@grafana/ui';

interface Props {
  panel: PanelModel;
}

export class GeneralTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  constructor(props) {
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

  onPanelDrillDownLinksChanged = (links: PanelDrillDownLink[]) => {
    this.props.panel.links = links;
    this.props.panel.render();
    this.forceUpdate();
  };

  render() {
    const { panel } = this.props;

    return (
      <EditorTabBody heading="General" toolbarItems={[]}>
        <>
          <div ref={element => (this.element = element)} />
          <PanelLinksEditor value={panel.links} onChange={this.onPanelDrillDownLinksChanged} />
        </>
      </EditorTabBody>
    );
  }
}
