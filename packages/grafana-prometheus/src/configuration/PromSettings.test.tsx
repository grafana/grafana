// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/PromSettings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SyntheticEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';

import { countError } from '../constants';
import { createDefaultConfigOptions } from '../test/mocks/datasource';

import { getValueFromEventItem, PromSettings } from './PromSettings';

beforeEach(() => {
  jest.replaceProperty(config, 'featureToggles', {
    prometheusCodeModeMetricNamesSearch: true,
  });
});

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(
          undefined as unknown as SyntheticEvent<HTMLInputElement> | SelectableValue<string>
        );
        expect(result).toEqual('');
      });
    });

    describe('when called with an input event', () => {
      it('then it should return value from currentTarget', () => {
        const value = 'An input value';
        const result = getValueFromEventItem({ currentTarget: { value } });
        expect(result).toEqual(value);
      });
    });

    describe('when called with a select event', () => {
      it('then it should return value', () => {
        const value = 'A select value';
        const result = getValueFromEventItem({ value });
        expect(result).toEqual(value);
      });
    });
  });

  describe('PromSettings component', () => {
    const defaultProps = createDefaultConfigOptions();

    it('should show POST httpMethod if no httpMethod', () => {
      const options = defaultProps;
      options.url = '';
      options.jsonData.httpMethod = '';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show POST httpMethod if POST httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'POST';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show GET httpMethod if GET httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'GET';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('GET')).toBeInTheDocument();
    });
    it('should show a valid metric name count if codeModeMetricNamesSuggestionLimit is configured correctly', () => {
      const options = defaultProps;

      const { getByTestId, queryByText } = render(<PromSettings onOptionsChange={() => {}} options={options} />);
      const input = getByTestId(
        selectors.components.DataSource.Prometheus.configPage.codeModeMetricNamesSuggestionLimit
      );

      // Non-negative integer
      fireEvent.change(input, { target: { value: '3000' } });
      fireEvent.blur(input);
      expect(queryByText(countError)).not.toBeInTheDocument();

      // Non-negative integer with scientific notation
      fireEvent.change(input, { target: { value: '1e5' } });
      fireEvent.blur(input);
      expect(queryByText(countError)).not.toBeInTheDocument();

      // Non-negative integer with decimal scientific notation
      fireEvent.change(input, { target: { value: '1.4e4' } });
      fireEvent.blur(input);
      expect(queryByText(countError)).not.toBeInTheDocument();
    });
    it('should show the expected error when an invalid value is provided for codeModeMetricNamesSuggestionLimit', () => {
      const options = defaultProps;

      const { getByTestId, queryByText } = render(<PromSettings onOptionsChange={() => {}} options={options} />);
      const input = getByTestId(
        selectors.components.DataSource.Prometheus.configPage.codeModeMetricNamesSuggestionLimit
      );

      // No negative values
      fireEvent.change(input, { target: { value: '-50' } });
      fireEvent.blur(input);
      expect(queryByText(countError)).toBeInTheDocument();

      // No negative values with scientific notation
      fireEvent.change(input, { target: { value: '-5e5' } });
      fireEvent.blur(input);
      expect(queryByText(countError)).toBeInTheDocument();
    });

    it('should have a series endpoint configuration element', () => {
      const options = defaultProps;

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('Use series endpoint')).toBeInTheDocument();
    });
  });
});
