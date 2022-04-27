import React from 'react';
import { CheckService } from 'app/percona/check/Check.service';
import { CheckTableRow } from './CheckTableRow';
import { Messages } from './AllChecksTab.messages';
import { CheckDetails } from 'app/percona/check/types';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme } from '@grafana/data/src';

const originalConsoleError = jest.fn();

const TEST_CHECK: CheckDetails = {
  summary: 'Test',
  name: 'test',
  interval: 'FREQUENT',
  description: 'test description',
  disabled: false,
};

const TEST_CHECK_DISABLED: CheckDetails = {
  summary: 'Test disabled',
  name: 'test disabled',
  interval: 'RARE',
  description: 'test disabled description',
  disabled: true,
};

const fakeOnSuccess = jest.fn();

const componentToHex = (c: number) => {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
};

const rgbToHex = (r: string, g: string, b: string) =>
  '#' + componentToHex(+r) + componentToHex(+g) + componentToHex(+b);

describe('CheckTableRow::', () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.resetAllMocks();
  });

  it('should render a check row correctly', async () => {
    const theme = createTheme();
    const wrapper = await waitFor(() => render(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />));

    let tdElements = wrapper.container.querySelectorAll('td');
    expect(tdElements[0]).toHaveTextContent('Test');
    expect(tdElements[1]).toHaveTextContent('test description');
    expect(tdElements[3]).toHaveTextContent('Frequent');
    expect(tdElements[4]).toHaveTextContent(Messages.disable);
    expect(screen.getByTestId('check-table-loader-button')).toBeInTheDocument();

    const colorStringDestructive = getComputedStyle(screen.getByTestId('check-table-loader-button')).backgroundColor;
    const colorDestructiveArr = colorStringDestructive.slice(4, colorStringDestructive.length - 1).split(',');
    const hexDestructiveValue = rgbToHex(colorDestructiveArr[0], colorDestructiveArr[1], colorDestructiveArr[2]);
    expect(hexDestructiveValue.toUpperCase()).toEqual(theme.colors.error.main);

    const wrapperDisabled = await waitFor(() =>
      render(<CheckTableRow check={TEST_CHECK_DISABLED} onSuccess={fakeOnSuccess} />)
    );
    let tdElementsCheckDisabled = wrapperDisabled.container.querySelectorAll('td');

    expect(tdElementsCheckDisabled[2]).toHaveTextContent(Messages.disabled);
    expect(tdElementsCheckDisabled[3]).toHaveTextContent('Rare');
    expect(tdElementsCheckDisabled[4]).toHaveTextContent(Messages.enable);
    expect(tdElementsCheckDisabled[4].querySelector('[data-testid="check-table-loader-button"]')).toBeInTheDocument();

    const colorStringPrimary = getComputedStyle(screen.getAllByTestId('check-table-loader-button')[1]).backgroundColor;
    const colorPrimaryArr = colorStringPrimary.slice(4, colorStringPrimary.length - 1).split(',');
    const hexPrimaryValue = rgbToHex(colorPrimaryArr[0], colorPrimaryArr[1], colorPrimaryArr[2]);
    expect(hexPrimaryValue.toUpperCase()).toEqual(theme.colors.primary.main);
  });

  it('should call an API to change the check status when the action button gets clicked', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');
    await waitFor(() => render(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />));

    expect(spy).toBeCalledTimes(0);

    fireEvent.click(screen.getByTestId('check-table-loader-button'));

    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith({ params: [{ name: TEST_CHECK.name, disable: true }] });
    spy.mockClear();
  });

  it('should call an API to change the check status when the action button gets clicked CHECK_DISABLED', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');

    await waitFor(() => render(<CheckTableRow check={TEST_CHECK_DISABLED} onSuccess={fakeOnSuccess} />));

    fireEvent.click(screen.getByTestId('check-table-loader-button'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toBeCalledWith({ params: [{ name: TEST_CHECK_DISABLED.name, enable: true }] });

    spy.mockClear();
  });

  it('should call the onSuccess callback after the change API succeeds', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');
    await waitFor(() => render(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />));

    expect(fakeOnSuccess).toBeCalledTimes(0);

    fireEvent.click(screen.getByTestId('check-table-loader-button'));

    await Promise.resolve();

    expect(fakeOnSuccess).toBeCalledTimes(1);

    spy.mockClear();
  });

  it('should log an error if the API call for check change fails', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck').mockImplementation(() => {
      throw Error('test');
    });

    render(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    fireEvent.click(screen.getByTestId('check-table-loader-button'));

    expect(console.error).toBeCalledTimes(1);
    spy.mockClear();
  });

  it('should log an error if the API call for check run fails', async () => {
    const spy = jest.spyOn(CheckService, 'runIndividualDbCheck').mockImplementation(() => {
      throw Error('test');
    });

    render(<CheckTableRow check={TEST_CHECK} onSuccess={fakeOnSuccess} />);

    fireEvent.click(screen.getByTestId('check-table-loader-button-run'));

    expect(console.error).toBeCalledTimes(1);
    spy.mockClear();
  });
});
