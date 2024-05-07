import React, { ChangeEvent, PureComponent } from 'react';
import uniqueId from 'lodash/uniqueId';

import { Button, Icon, InlineFieldRow, InlineField, Select, Input } from '@grafana/ui';
import { GetQuery, DisplayNames } from './types';
import { SelectableValue } from '@grafana/data';

interface State {
  displayNames: DisplayNames;
};

interface DisplayNameSettingsProps {
  query: GetQuery;
  onChange: (query: GetQuery) => void;
};

export class DisplayNameSettings extends PureComponent<DisplayNameSettingsProps, State> {
  state: State = {
    displayNames: []
  };

  constructor(props: DisplayNameSettingsProps) {
    super(props);
    this.state = {
      displayNames: this.props.query.displayNames || []
    };
  };

  updateSettings = () => {
    const { displayNames } = this.state;

    this.props.onChange({
      ...this.props.query,
      displayNames: displayNames,
    });
  };

  onDisplayNameAdd = () => {
    this.setState((prevState) => {
      return { displayNames: [...prevState.displayNames, { id: uniqueId(), field: '', value: '' }] };
    });
  };

  onDisplayNameFieldChange = (displayNameIndex: number, value: SelectableValue<string>) => {
    this.setState(({ displayNames }) => {
      return {
        displayNames: displayNames.map((displayName, i) => {
          if (displayNameIndex !== i) {
            return displayName;
          }
          return {
            ...displayName,
            field: value.value!
          };
        })
      };
    }, this.updateSettings);
  };

  onDisplayNameValueChange = (displayNameIndex: number, value: ChangeEvent<HTMLInputElement>) => {
    this.setState(({ displayNames }) => {
      return {
        displayNames: displayNames.map((displayName, i) => {
          if (displayNameIndex !== i) {
            return displayName;
          }
          return { ...displayName, value: value.target.value };
        })
      };
    }, this.updateSettings);
  };

  onDisplayNameRemove = (displayNameId: string) => {
    this.setState(
      ({ displayNames }) => ({
        displayNames: displayNames.filter((h) => h.id !== displayNameId),
      }),
      this.updateSettings
    );
  };

  render() {
    const displayNames = this.state.displayNames;
    const filteredMetrics = this.props.query.metrics?.filter(m => !this.props.query.aggregations?.some(a => a.fields.some(f => f === m.metricId)));
    const metricNames: Array<SelectableValue<string>> = filteredMetrics?.map(m => ({ label: m.metricId, value: m.metricId })) ?? [];
    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <h6>Display Names</h6>
        </div>
        {displayNames.map((displayName, i) => (
          <InlineFieldRow>
            <InlineField label="Field" labelWidth={20}>
              <Select
                options={metricNames}
                value={displayName.field}
                width={25}
                onChange={(v) => {
                  this.onDisplayNameFieldChange(i, v);
                }} />
            </InlineField>
            <InlineField label="Value" labelWidth={20}>
              <Input
                value={displayName.value}
                width={25}
                onChange={(v: ChangeEvent<HTMLInputElement>) => {
                  this.onDisplayNameValueChange(i, v);
                }}
              />
            </InlineField>
            <Button variant="secondary" size="xs" onClick={() => this.onDisplayNameRemove(displayName.id)}>
              <Icon name="trash-alt" />
            </Button>
          </InlineFieldRow>
        ))}
        <Button
          type="button"
          variant="secondary"
          icon="plus"
          onClick={() => {
            this.onDisplayNameAdd();
          }}
        >
          Add Display Name
        </Button>
      </div>
    );
  }
};

export default DisplayNameSettings;
