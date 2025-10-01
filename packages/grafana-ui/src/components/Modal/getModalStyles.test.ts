import { getModalStyles } from './getModalStyles';

// Mock theme object for testing
const mockTheme = {
  zIndex: {
    modal: 1000,
    modalBackdrop: 999,
  },
  colors: {
    background: {
      primary: '#ffffff',
    },
    border: {
      weak: 'rgba(0, 0, 0, 0.12)',
      medium: 'rgba(0, 0, 0, 0.3)',
      strong: 'rgba(0, 0, 0, 0.4)',
    },
    text: {
      secondary: '#666666',
    },
  },
  shadows: {
    z3: '0 3px 6px rgba(0, 0, 0, 0.16)',
  },
  shape: {
    radius: {
      lg: '8px',
    },
  },
  spacing: (value: number) => `${value * 8}px`,
  components: {
    overlay: {
      background: 'rgba(0, 0, 0, 0.5)',
    },
  },
  typography: {
    size: {
      lg: '18px',
    },
  },
} as any;

// This test validates that our fix for issue #102190 is working correctly
// We changed the modal border from border.weak to border.medium to fix
// the visual artifact where semi-transparent borders create a "gap" appearance
describe('getModalStyles - Issue #102190 Fix', () => {
  it('should use border.medium for modal border to fix semi-transparent appearance', () => {
    const styles = getModalStyles(mockTheme);
    
    // The modal styles should include the medium border color, not weak
    // This is verified by checking the generated CSS string contains the expected border declaration
    const modalStyleString = styles.modal.toString();
    
    // Our change should use the medium border which is more opaque
    expect(modalStyleString).toContain('rgba(0, 0, 0, 0.3)');
  });

  it('should not use the problematic weak border that caused the visual artifact', () => {
    const styles = getModalStyles(mockTheme);
    
    const modalStyleString = styles.modal.toString();
    
    // Ensure we no longer use the semi-transparent weak border that caused the issue
    expect(modalStyleString).not.toContain('rgba(0, 0, 0, 0.12)');
  });
});