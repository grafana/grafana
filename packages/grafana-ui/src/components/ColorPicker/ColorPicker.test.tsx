import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';

import { ColorPicker } from './ColorPicker';

describe('ColorPicker', () => {
  it('renders ColorPickerTrigger component by default', () => {
    render(<ColorPicker color="#EAB839" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '#EAB839 color' })).toBeInTheDocument();
  });

  it('adds the label of the surrounding InlineField to its name', () => {
    render(
      <InlineField label="Background">
        <ColorPicker color="#EAB839" onChange={() => {}} />
      </InlineField>
    );
    expect(screen.getByRole('button', { name: 'Background #EAB839 color' })).toBeInTheDocument();
  });

  it('adds the label of the surrounding Field to its name', () => {
    render(
      <Field label="Background">
        <ColorPicker color="#EAB839" onChange={() => {}} />
      </Field>
    );
    expect(screen.getByRole('button', { name: 'Background #EAB839 color' })).toBeInTheDocument();
  });

  it('should not have buttons with default submit type', async () => {
    render(<ColorPicker color="blue" enableNamedColors onChange={() => {}} />);
    const mainButton = screen.getAllByRole('button');
    expect(mainButton.length).toBe(1);
    mainButton.forEach((button) => expect(button).toHaveAttribute('type', 'button'));
    await userEvent.click(mainButton[0]);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(33);
    buttons.forEach((button) => expect(button).toHaveAttribute('type', 'button'));

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
  });

  it('renders custom trigger when supplied', () => {
    render(
      <ColorPicker color="#EAB839" onChange={() => {}}>
        {() => <div>Custom trigger</div>}
      </ColorPicker>
    );
    expect(screen.getByText('Custom trigger')).toBeInTheDocument();
  });
});
