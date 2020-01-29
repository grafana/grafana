import React, { PureComponent } from 'react';
import { VariableIdentifier } from '../state/actions';
import { VariableState } from '../state/queryVariableReducer';
import { Subscription } from 'rxjs';
import { subscribeToVariableChanges } from '../subscribeToVariableStateChanges';
import { variableAdapters } from './index';

export interface VariableRendererProps extends VariableIdentifier {
  componentType: 'picker' | 'editor';
}

export class VariableRenderer extends PureComponent<VariableRendererProps, VariableState> {
  private readonly subscription: Subscription = null;
  constructor(props: VariableRendererProps) {
    super(props);
    this.subscription = subscribeToVariableChanges<VariableState>(props).subscribe({
      next: state => {
        if (this.state) {
          this.setState({ ...state });
          return;
        }

        this.state = state;
      },
    });
  }

  componentWillUnmount(): void {
    this.subscription.unsubscribe();
  }

  render() {
    const { type, componentType } = this.props;
    if (!variableAdapters.contains(type)) {
      return null;
    }

    const adapter = variableAdapters.get(type);
    const ComponentToRender = adapter[componentType];
    if (!ComponentToRender) {
      return null;
    }

    return <ComponentToRender {...this.state} />;
  }
}
