import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationUtil } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { AttributePluginPromoTip } from './AttributePluginPromoTip';
import { type AttributePluginPromo } from './attributePluginPromos';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const promo: AttributePluginPromo = {
  pluginId: 'grafana-dbo11y-app',
  icon: 'database-observability',
  title: 'Find slow queries faster',
  body: 'Database Observability surfaces visual explain plans, wait events, and query samples — helping you diagnose issues beyond trace spans.',
  match: () => true,
};

describe('AttributePluginPromoTip', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders children and shows promo content on click', async () => {
    const user = userEvent.setup();
    render(
      <AttributePluginPromoTip promo={promo}>
        <span>SELECT 1</span>
      </AttributePluginPromoTip>
    );

    expect(screen.getByText('SELECT 1')).toBeInTheDocument();
    expect(screen.getByTestId('attribute-plugin-promo-trigger')).toBeInTheDocument();

    await user.click(screen.getByTestId('attribute-plugin-promo-trigger'));

    expect(await screen.findByText('Find slow queries faster')).toBeInTheDocument();
    expect(screen.getByText(/visual explain plans, wait events, and query samples/i)).toBeInTheDocument();

    const learnMore = screen.getByRole('link', { name: /learn more/i });
    expect(learnMore).toHaveAttribute('href', locationUtil.assureBaseUrl(`/plugins/${promo.pluginId}`));
  });

  it('reports interaction when the learn more link is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AttributePluginPromoTip promo={promo}>
        <span>SELECT 1</span>
      </AttributePluginPromoTip>
    );

    await user.click(screen.getByTestId('attribute-plugin-promo-trigger'));

    const learnMore = await screen.findByRole('link', { name: /learn more/i });
    learnMore.addEventListener('click', (event) => event.preventDefault());
    await user.click(learnMore);

    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_attribute_plugin_promo_clicked', {
      pluginId: 'grafana-dbo11y-app',
    });
  });
});
