import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { TypeSelectorButton } from './QueryAndExpressionsStep';

const renderTypeSelector = (sqlExpressionsEnabled = true) => {
  const onClickDynamicThreshold = jest.fn();
  const onClickType = jest.fn();

  render(
    <TypeSelectorButton
      onClickType={onClickType}
      onClickDynamicThreshold={onClickDynamicThreshold}
      sqlExpressionsEnabled={sqlExpressionsEnabled}
    />
  );

  return { onClickDynamicThreshold, onClickType };
};

const openExpressionMenu = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('add-expression-button'));
  return user;
};

describe('TypeSelectorButton', () => {
  it('hides dynamic threshold when the feature flag is disabled', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: false });
    renderTypeSelector();

    await openExpressionMenu();

    expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
  });

  it('shows dynamic threshold when SQL expressions and the feature flag are enabled', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: true });
    const { onClickDynamicThreshold } = renderTypeSelector();

    const user = await openExpressionMenu();
    await user.click(screen.getByText('Dynamic threshold'));

    expect(onClickDynamicThreshold).toHaveBeenCalledTimes(1);
  });

  it('hides dynamic threshold when SQL expressions are unavailable', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: true });
    renderTypeSelector(false);

    await openExpressionMenu();

    expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
  });

  it('keeps ordinary expression selection unchanged', async () => {
    setTestFlags({ [FlagKeys.AlertingDynamicThresholdExpression]: true });
    const { onClickType } = renderTypeSelector();

    const user = await openExpressionMenu();
    await user.click(screen.getByText('Math'));

    expect(onClickType).toHaveBeenCalledWith(ExpressionQueryType.math);
  });
});
