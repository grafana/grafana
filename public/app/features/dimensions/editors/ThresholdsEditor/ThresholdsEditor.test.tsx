import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createTheme, ThresholdsMode } from '@grafana/data';
import { mockThemeContext, colors } from '@grafana/ui';

import { ThresholdsEditor, Props } from './ThresholdsEditor';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    onChange: jest.fn(),
    thresholds: { mode: ThresholdsMode.Absolute, steps: [] },
  };

  Object.assign(props, propOverrides);

  return render(<ThresholdsEditor {...props} />);
};

describe('ThresholdsEditor', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  it('should render with base threshold', () => {
    const wrapper = setup();
    expect(wrapper.getByLabelText(/Threshold/)).toHaveValue('Base');
  });

  describe('Add threshold', () => {
    it('should add threshold', async () => {
      const wrapper = setup();
      const user = userEvent.setup();

      expect(wrapper.getAllByLabelText(/Threshold/)).toHaveLength(1);
      await user.click(wrapper.getByRole('button', { name: /Add threshold/ }));
      expect(wrapper.getAllByLabelText(/Threshold/)).toHaveLength(2);
    });

    it('should add another threshold above last', async () => {
      const wrapper = setup({
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: colors[0] }, // 0
            { value: 50, color: colors[2] }, // 1
          ],
        },
      });

      const user = userEvent.setup();
      await user.click(wrapper.getByRole('button', { name: /Add threshold/ }));
      expect(wrapper.getAllByLabelText(/Threshold/)).toHaveLength(3);
      expect(wrapper.getByLabelText(/Threshold 1/)).toHaveValue(60);
    });
  });

  describe('Remove threshold', () => {
    it('should remove threshold', async () => {
      const thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
          { value: 75, color: '#6ED0E0' },
        ],
      };

      const wrapper = setup({ thresholds });
      const user = userEvent.setup();
      expect(wrapper.getAllByLabelText(/Threshold/)).toHaveLength(3);

      await user.click(wrapper.getAllByLabelText('Remove threshold')[0]);
      expect(wrapper.getAllByLabelText(/Threshold/)).toHaveLength(2);
    });
  });

  describe('change threshold value', () => {
    it('Base input should be disabled', () => {
      const thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
          { value: 75, color: '#6ED0E0' },
        ],
      };

      const wrapper = setup({ thresholds });
      const baseThresholdInput = wrapper.getByLabelText(/Threshold 3/);
      expect(baseThresholdInput).toHaveValue('Base');
      expect(baseThresholdInput).toBeDisabled();
    });

    it('should update value', async () => {
      const thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D', key: 1 },
          { value: 50, color: '#EAB839', key: 2 },
          { value: 75, color: '#6ED0E0', key: 3 },
        ],
      };
      const wrapper = setup({ thresholds });

      const thresholdInput = wrapper.getByLabelText('Threshold 1');
      const user = userEvent.setup();
      await user.type(thresholdInput, '{selectall}{backspace}{backspace}78');
      expect(thresholdInput).toHaveValue(78);
    });
  });

  describe('on blur threshold value', () => {
    it('should resort rows and update indexes', async () => {
      const thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D', key: 1 },
          { value: 78, color: '#EAB839', key: 2 },
          { value: 75, color: '#6ED0E0', key: 3 },
        ],
      };
      const wrapper = setup({ thresholds });

      let thresholdInputs = wrapper.getAllByLabelText(/Threshold/);
      const user = userEvent.setup();
      await user.click(thresholdInputs[0]);
      await user.click(thresholdInputs[1]);

      thresholdInputs = wrapper.getAllByLabelText(/Threshold/);
      expect(thresholdInputs[0]).toHaveValue(78);
      expect(thresholdInputs[1]).toHaveValue(75);
      expect(thresholdInputs[2]).toBeDisabled();
    });
  });

  describe('on load with invalid steps', () => {
    it('should exclude invalid steps and render a proper list', () => {
      const wrapper = setup({
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: '#7EB26D', key: 1 },
            { value: 75, color: '#6ED0E0', key: 2 },
            { color: '#7EB26D', key: 3 } as any,
            { value: 78, color: '#EAB839', key: 4 },
            { value: null, color: '#7EB26D', key: 5 } as any,
            { value: null, color: '#7EB26D', key: 6 } as any,
          ],
        },
      });

      const thresholdInputs = wrapper.getAllByLabelText(/Threshold/);
      expect(thresholdInputs[0]).toHaveValue(78);
      expect(thresholdInputs[1]).toHaveValue(75);
      expect(thresholdInputs[2]).toBeDisabled();
    });
  });
});
