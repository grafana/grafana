import { render, screen } from '@testing-library/react';

import { AnnotationAvatar } from './AnnotationAvatar';

describe('AnnotationAvatar', () => {
  it('does not render when empty', () => {
    const { container } = render(<AnnotationAvatar src={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('sanitizes javascript', () => {
    it('alert', () => {
      render(<AnnotationAvatar src="javascript:alert('pwned')" />);
      const img = screen.getByRole('img', { name: 'Annotation avatar' });
      expect(img).toHaveAttribute('src', 'about:blank');
    });

    it('void', () => {
      render(<AnnotationAvatar src="javascript:void(0)" />);
      const img = screen.getByRole('img', { name: 'Annotation avatar' });
      expect(img).toHaveAttribute('src', 'about:blank');
    });
  });

  it('allows https URLs through', () => {
    const safeUrl = 'https://grafana.com/static/assets/img/grot-404.svg';
    render(<AnnotationAvatar src={safeUrl} />);
    const img = screen.getByRole('img', { name: 'Annotation avatar' });
    expect(img).toHaveAttribute('src', safeUrl);
  });
});
