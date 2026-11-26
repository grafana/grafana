import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { AbstractButton } from './AbstractButton';

describe('AbstractButton', () => {
  describe('element type', () => {
    it('renders a button by default', () => {
      render(<AbstractButton>Save</AbstractButton>);
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders an anchor when as is "a"', () => {
      render(
        <AbstractButton as="a" href="/dashboards">
          Dashboards
        </AbstractButton>
      );
      expect(screen.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/dashboards');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders an anchor without an href attribute when as is "a" and there is no href', () => {
      render(<AbstractButton as="a">Placeholder</AbstractButton>);
      const anchor = screen.getByText('Placeholder').closest('a');
      expect(anchor).toBeInTheDocument();
      expect(anchor).not.toHaveAttribute('href');
    });

    it('forwards the ref to the rendered element', () => {
      const buttonRef = createRef<HTMLButtonElement>();
      const anchorRef = createRef<HTMLAnchorElement>();
      render(
        <>
          <AbstractButton ref={buttonRef}>Save</AbstractButton>
          <AbstractButton as="a" ref={anchorRef} href="/docs">
            Docs
          </AbstractButton>
        </>
      );
      expect(buttonRef.current).toBe(screen.getByRole('button', { name: 'Save' }));
      expect(anchorRef.current).toBe(screen.getByRole('link', { name: 'Docs' }));
    });
  });

  describe('as a button', () => {
    it('calls onClick when clicked', async () => {
      const onClick = jest.fn();
      render(<AbstractButton onClick={onClick}>Save</AbstractButton>);
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const onClick = jest.fn();
      render(
        <AbstractButton onClick={onClick} disabled>
          Save
        </AbstractButton>
      );
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('uses aria-disabled instead of disabled when it has a tooltip, so the tooltip stays reachable', async () => {
      const onClick = jest.fn();
      render(
        <AbstractButton onClick={onClick} disabled tooltip="Not available">
          Save
        </AbstractButton>
      );
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('as an anchor', () => {
    it('sanitizes javascript: URLs', () => {
      render(
        <AbstractButton as="a" href="javascript:alert(1)">
          Open
        </AbstractButton>
      );
      expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', 'about:blank');
    });

    it('leaves the tab order and is marked disabled when disabled', () => {
      render(
        <AbstractButton as="a" href="/docs" disabled>
          Docs
        </AbstractButton>
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('content', () => {
    it('applies the class names it is given and none of its own', () => {
      render(
        <AbstractButton className="root" contentClassName="content">
          Save
        </AbstractButton>
      );
      expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('root', { exact: true });
      expect(screen.getByText('Save')).toHaveClass('content', { exact: true });
    });

    it.each([
      ['left', 0],
      ['right', 1],
    ] as const)('places the icon on the %s', (iconPlacement, iconIndex) => {
      render(
        <AbstractButton icon="cloud" iconPlacement={iconPlacement}>
          Save
        </AbstractButton>
      );
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button.childNodes).toHaveLength(2);
      expect(button.childNodes[iconIndex]).toBe(screen.getByTitle(''));
      expect(button.childNodes[1 - iconIndex]).toBe(screen.getByText('Save'));
    });

    it('uses a string tooltip as the accessible name when there are no children', () => {
      render(<AbstractButton icon="cloud" tooltip="Upload" />);
      expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    });

    it('prefers aria-label over the tooltip', () => {
      render(<AbstractButton icon="cloud" tooltip="Upload" aria-label="Upload file" />);
      expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    });
  });
});
