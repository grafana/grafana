import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { Checkbox } from '../Forms/Checkbox';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../Input/Input';
import { SelectBase } from '../Select/SelectBase';
import { Switch } from '../Switch/Switch';
import { TextArea } from '../TextArea/TextArea';

import { AutoSaveField, Props } from './AutoSaveField';

const mockOnFinishChange = jest.fn().mockImplementation(() => Promise.resolve());
const mockOnFinishChangeError = jest.fn().mockImplementation(() => Promise.reject());
const options: Array<SelectableValue<string>> = [
  {
    label: 'Light',
    value: 'light',
  },
  {
    label: 'Dark',
    value: 'dark',
  },
  {
    label: 'Default',
    value: 'default',
  },
];
const setup = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props, 'children'> = {
    label: 'Test',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'input-test',
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField {...props}>
      {(onChange) => <Input id="input-test" name="input-test" onChange={(e) => onChange(e.currentTarget.value)} />}
    </AutoSaveField>
  );
};

const setupTextArea = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props, 'children'> = {
    label: 'Test',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'textarea-test',
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField {...props}>
      {(onChange) => (
        <TextArea id="textarea-test" name="textarea-test" onChange={(e) => onChange(e.currentTarget.value)} />
      )}
    </AutoSaveField>
  );
};

const setupCheckbox = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props<Boolean>, 'children'> = {
    label: 'Test',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'checkbox-test',
    defaultChecked: false,
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField<Boolean> {...props}>
      {(onChange) => (
        <Checkbox
          id="checkbox-test"
          name="checkbox-test"
          onChange={(e) => {
            onChange(e.currentTarget.checked);
          }}
        />
      )}
    </AutoSaveField>
  );
};

const setupSwitch = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props<Boolean>, 'children'> = {
    label: 'Test',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'switch-test',
    defaultChecked: false,
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField<Boolean> {...props}>
      {(onChange) => (
        <Switch
          id="switch-test"
          name="switch-test"
          onChange={(e) => {
            onChange(e.currentTarget.checked);
          }}
        />
      )}
    </AutoSaveField>
  );
};

const setupRadioButton = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props, 'children'> = {
    label: 'Choose your theme',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'radio-button-group-test',
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField {...props}>
      {(onChange) => (
        <RadioButtonGroup
          id="radio-button-group-test"
          onChange={(option) => {
            onChange(option);
          }}
          options={options}
        />
      )}
    </AutoSaveField>
  );
};

const setupSelect = (propOverrides?: Partial<Props>) => {
  const props: Omit<Props, 'children'> = {
    label: 'Choose your theme',
    onFinishChange: mockOnFinishChange,
    htmlFor: 'select-test',
  };

  Object.assign(props, propOverrides);

  render(
    <AutoSaveField {...props}>
      {(onChange) => (
        <SelectBase
          data-testid="select-test"
          onChange={(option) => {
            onChange(option.value ?? '');
          }}
          options={options}
        />
      )}
    </AutoSaveField>
  );
};

/* 
Cases to cover:
1.- General:
  a) It renders
  b) It has a children
  c) It has a onFinishChange function
  d) If success, the InlineToast renders on the right
  e) If success but not enough space, the InlineToas renders on the bottom
2.- Per child:
  a) It renders
  b) When it is succesful, it show the InlineToast saying Saved!
  c) When there was an error, show the error message
  d) When there was an error and the child has an invalid prop, show the red border
*/

describe('AutoSaveField ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with an Input as a children', () => {
    setup();
    expect(
      screen.getByRole('textbox', {
        name: 'Test',
      })
    ).toBeInTheDocument();
  });
  it('triggers the function on change by typing and shows the InlineToast', async () => {
    setup();
    const inputField = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(inputField, 'This is a test text');
    expect(inputField).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });
});

describe('Input, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setup({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    const inputField = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(inputField, 'This is a test text');
    expect(inputField).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });

  it('shows a red border when invalid is true', async () => {
    setup({ invalid: true, onFinishChange: mockOnFinishChangeError });
    const inputField = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(inputField, 'This is a test text');
    expect(inputField).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).not.toHaveBeenCalled();
    expect(inputField).toHaveStyle(`border: 1px solid #ff5286;`);
  });
});

describe('TextArea, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders itself', () => {
    setupTextArea();
    expect(
      screen.getByRole('textbox', {
        name: 'Test',
      })
    ).toBeInTheDocument();
  });
  it('triggers the function on change by typing and shows the InlineToast', async () => {
    setupTextArea();
    const textArea = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(textArea, 'This is a test text');
    expect(textArea).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });

    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setupTextArea({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    const textArea = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(textArea, 'This is a test text');
    expect(textArea).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });

  it('shows a red border when invalid is true', async () => {
    setupTextArea({ invalid: true, onFinishChange: mockOnFinishChangeError });
    const textArea = screen.getByRole('textbox', {
      name: 'Test',
    });
    await user.type(textArea, 'This is a test text');
    expect(textArea).toHaveValue('This is a test text');
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).not.toHaveBeenCalled();
    expect(textArea).toHaveStyle(`border: 1px solid rgba(204, 204, 220, 0.15)`);
  });
});

describe('Checkbox, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders itself', () => {
    setupCheckbox();
    expect(
      screen.getByRole('checkbox', {
        name: 'Test',
      })
    ).toBeInTheDocument();
  });
  it('triggers the function on change by click on it and shows the InlineToast', async () => {
    setupCheckbox();
    const checkbox = screen.getByRole('checkbox', {
      name: 'Test',
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setupCheckbox({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    const checkbox = screen.getByRole('checkbox', {
      name: 'Test',
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });
});

describe('Switch, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders itself', () => {
    setupSwitch();
    //Is there another way to find the switch element? Filtering by name doesn't work
    expect(
      screen.getByRole('checkbox', {
        checked: false,
      })
    ).toBeInTheDocument();
  });
  it('triggers the function on change by toggle it and shows the InlineToast', async () => {
    setupSwitch();
    const switchInput = screen.getByRole('checkbox', {
      checked: false,
    });
    await user.click(switchInput);
    expect(switchInput).toBeChecked();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setupSwitch({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    const switchInput = screen.getByRole('checkbox', {
      checked: false,
    });
    await user.click(switchInput);
    expect(switchInput).toBeChecked();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });
});

describe('RadioButtonGroup, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders itself', () => {
    setupRadioButton();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
  it('triggers the function on change by click on an option and shows the InlineToast', async () => {
    setupRadioButton();
    const radioOption = screen.getByRole('radio', {
      name: /Light/,
    });
    await user.click(radioOption);
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setupRadioButton({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    const radioOption = screen.getByRole('radio', {
      name: /Light/,
    });
    await user.click(radioOption);
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });
});

describe('Select, as AutoSaveField child, ', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders itself', async () => {
    setupSelect();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.click(screen.getByText('Choose'));
    const selectOptions = screen.getAllByLabelText('Select option');
    expect(selectOptions).toHaveLength(3);
  });
  it('triggers the function on change by selecting an option and shows the InlineToast', async () => {
    setupSelect();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.click(screen.getByText('Choose'));
    const selectOptions = screen.getAllByLabelText('Select option');
    await user.click(selectOptions[1]);
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChange).toHaveBeenCalled();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error message if there was any problem with the request', async () => {
    setupSelect({ saveErrorMessage: 'There was an error', onFinishChange: mockOnFinishChangeError });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.click(screen.getByText('Choose'));
    const selectOptions = screen.getAllByLabelText('Select option');
    await user.click(selectOptions[1]);
    act(() => {
      jest.runAllTimers();
    });
    expect(mockOnFinishChangeError).toHaveBeenCalled();
    expect(await screen.findByText('There was an error')).toBeInTheDocument();
  });

  /*TODO*/
  // it('shows a red border when invalid is true', async () => {
  //   setupSelect({ invalid: true, onFinishChange: mockOnFinishChangeError });
  //   const selectInput = screen.getByRole('combobox');
  //   expect(selectInput).toBeInTheDocument();
  //   await user.click(screen.getByText('Choose'));
  //   const selectOptions = screen.getAllByLabelText('Select option');
  //   await user.click(selectOptions[1]);
  //   act(() => {
  //     jest.runAllTimers();
  //   });
  //   expect(mockOnFinishChangeError).not.toHaveBeenCalled();
  //   expect(screen.getByTestId('select-test')).toHaveStyle(`border: 1px solid #ff5286;`);
  // });
});
