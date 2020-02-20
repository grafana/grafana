import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import { VariableIdentifier } from '../state/actions';
import { subscribeToVariableChanges } from '../subscribeToVariableStateChanges';
import { variableAdapters } from './index';
import { VariableEditor } from '../editor/VariableEditor';
import { VariableState } from '../state/types';
import { VariablePicker } from '../picker/VariablePicker';

export interface VariableRendererProps extends VariableIdentifier {
  componentType: 'picker' | 'editor';
}

export class VariableRenderer extends PureComponent<VariableRendererProps, VariableState> {
  private readonly subscription: Subscription | null = null;
  constructor(props: VariableRendererProps) {
    super(props);

    // editing a new variable
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
    this.subscription?.unsubscribe();
  }

  render() {
    const { type, componentType } = this.props;

    if (!variableAdapters.contains(type)) {
      return null;
    }

    if (componentType === 'picker') {
      return <VariablePicker {...this.state} />;
    }

    return <VariableEditor {...this.state} />;
  }
}
