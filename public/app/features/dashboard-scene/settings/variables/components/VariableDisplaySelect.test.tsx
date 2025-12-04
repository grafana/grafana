import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableHide } from '@grafana/data';

import { VariableDisplaySelect } from './VariableDisplaySelect';

// For testing combobox
beforeAll(() => {
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });
});

describe('VariableDisplaySelect', () => {
  it('should render all options when opening the combobox', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<VariableDisplaySelect onChange={onChange} display={VariableHide.dontHide} type="query" />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    expect(await screen.findByText('Above dashboard')).toBeInTheDocument();
    expect(screen.getByText('Above dashboard, label hidden')).toBeInTheDocument();
    expect(screen.getByText('Controls menu')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('should call onChange() with the selected value', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<VariableDisplaySelect onChange={onChange} display={VariableHide.dontHide} type="query" />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    const controlsMenuOption = await screen.findByText('Controls menu');
    await user.click(controlsMenuOption);

    expect(onChange).toHaveBeenCalledWith(VariableHide.inControlsMenu);
  });

  it('should have "Controls menu" selected when `hide` is set to "inControlsMenu"', () => {
    const onChange = jest.fn();
    render(<VariableDisplaySelect onChange={onChange} display={VariableHide.inControlsMenu} type="query" />);

    expect(screen.getByDisplayValue('Controls menu')).toBeInTheDocument();
  });

  it('should not render anything for constant type variables', () => {
    const onChange = jest.fn();
    const { container } = render(
      <VariableDisplaySelect onChange={onChange} display={VariableHide.dontHide} type="constant" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should call onChange() when switching from "Controls menu" to "Above dashboard"', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<VariableDisplaySelect onChange={onChange} display={VariableHide.inControlsMenu} type="query" />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    const aboveDashboardOption = await screen.findByText('Above dashboard');
    await user.click(aboveDashboardOption);

    expect(onChange).toHaveBeenCalledWith(VariableHide.dontHide);
  });
});
