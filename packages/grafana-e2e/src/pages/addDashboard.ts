import { pageFactory } from '../support';

export const AddDashboard = pageFactory({
  url: '/dashboard/new',
  selectors: {
    ctaButtons: (text: string) => `Add Panel Widget CTA Button ${text}`,
  },
});
