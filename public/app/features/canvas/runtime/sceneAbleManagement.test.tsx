import {
  calculateZoomToFitScale,
  extractTranslateFromTransform,
  calculateGroupBoundingBox,
} from './sceneAbleManagement';

describe('sceneAbleManagement helper functions', () => {
  describe('extractTranslateFromTransform', () => {
    it('should extract translate values from transform string', () => {
      const transform = 'translate(100px, 200px)';
      const result = extractTranslateFromTransform(transform);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should extract translate values from matrix transform', () => {
      const transform = 'matrix(1, 0, 0, 1, 50, 75)';
      const result = extractTranslateFromTransform(transform);
      expect(result).toEqual({ x: 50, y: 75 });
    });

    it('should handle transform with translate3d', () => {
      const transform = 'translate3d(30px, 40px, 0px)';
      const result = extractTranslateFromTransform(transform);
      expect(result).toEqual({ x: 30, y: 40 });
    });

    it('should handle empty transform string', () => {
      const result = extractTranslateFromTransform('');
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle transform with no translate', () => {
      const transform = 'scale(2) rotate(45deg)';
      const result = extractTranslateFromTransform(transform);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle complex transform with multiple values', () => {
      const transform = 'translate(10px, 20px) scale(1.5) rotate(30deg)';
      const result = extractTranslateFromTransform(transform);
      expect(result).toEqual({ x: 10, y: 20 });
    });
  });

  describe('calculateGroupBoundingBox', () => {
    let mockElements: Element[];

    beforeEach(() => {
      // Mock window.getComputedStyle
      global.window.getComputedStyle = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should calculate bounding box for single element', () => {
      const mockElement = document.createElement('div');
      mockElements = [mockElement];

      (window.getComputedStyle as jest.Mock).mockReturnValue({
        transform: 'translate(10px, 20px)',
        width: '100px',
        height: '50px',
      });

      const result = calculateGroupBoundingBox(mockElements);

      expect(result).toEqual({
        left: 10,
        top: 20,
        right: 110,
        bottom: 70,
        width: 100,
        height: 50,
        centerX: 60,
        centerY: 45,
      });
    });

    it('should calculate bounding box for multiple elements', () => {
      const mockElement1 = document.createElement('div');
      const mockElement2 = document.createElement('div');
      mockElements = [mockElement1, mockElement2];

      (window.getComputedStyle as jest.Mock)
        .mockReturnValueOnce({
          transform: 'translate(0px, 0px)',
          width: '50px',
          height: '30px',
        })
        .mockReturnValueOnce({
          transform: 'translate(100px, 80px)',
          width: '60px',
          height: '40px',
        });

      const result = calculateGroupBoundingBox(mockElements);

      expect(result).toEqual({
        left: 0,
        top: 0,
        right: 160,
        bottom: 120,
        width: 160,
        height: 120,
        centerX: 80,
        centerY: 60,
      });
    });

    it('should handle elements with no transform', () => {
      const mockElement = document.createElement('div');
      mockElements = [mockElement];

      (window.getComputedStyle as jest.Mock).mockReturnValue({
        transform: '',
        width: '75px',
        height: '25px',
      });

      const result = calculateGroupBoundingBox(mockElements);

      expect(result).toEqual({
        left: 0,
        top: 0,
        right: 75,
        bottom: 25,
        width: 75,
        height: 25,
        centerX: 37.5,
        centerY: 12.5,
      });
    });

    it('should handle negative transform values', () => {
      const mockElement = document.createElement('div');
      mockElements = [mockElement];

      (window.getComputedStyle as jest.Mock).mockReturnValue({
        transform: 'translate(-20px, -30px)',
        width: '100px',
        height: '80px',
      });

      const result = calculateGroupBoundingBox(mockElements);

      expect(result).toEqual({
        left: -20,
        top: -30,
        right: 80,
        bottom: 50,
        width: 100,
        height: 80,
        centerX: 30,
        centerY: 10,
      });
    });

    it('should handle empty elements array', () => {
      const result = calculateGroupBoundingBox([]);

      expect(result).toEqual({
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity,
        width: -Infinity,
        height: -Infinity,
        centerX: NaN,
        centerY: NaN,
      });
    });
  });

  describe('calculateZoomToFitScale', () => {
    let mockContainer: HTMLDivElement;
    let mockElements: Element[];

    beforeEach(() => {
      mockContainer = document.createElement('div');
      mockElements = [document.createElement('div')];

      // Mock getBoundingClientRect
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 800,
        height: 600,
      });

      // Mock window.getComputedStyle
      global.window.getComputedStyle = jest.fn().mockReturnValue({
        transform: 'translate(0px, 0px)',
        width: '400px',
        height: '300px',
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should calculate scale to fit content with default padding', () => {
      const result = calculateZoomToFitScale(mockElements, mockContainer);

      // Container: 800x600, Content: 400x300
      // Padded container: 760x570 (5% padding on each side)
      // Scale: min(760/400, 570/300) = min(1.9, 1.9) = 1.9
      expect(result.scale).toBeCloseTo(1.9);
      expect(result.centerX).toBeCloseTo(-200); // Center calculation
      expect(result.centerY).toBeCloseTo(-115); // Center calculation
    });

    it('should calculate scale to fit content with custom padding', () => {
      const result = calculateZoomToFitScale(mockElements, mockContainer, 0.1);

      // Container: 800x600, Content: 400x300
      // Padded container: 640x480 (10% padding on each side)
      // Scale: min(640/400, 480/300) = min(1.6, 1.6) = 1.6
      expect(result.scale).toBeCloseTo(1.6);
      expect(result.centerX).toBeCloseTo(-150); // Center calculation
      expect(result.centerY).toBeCloseTo(-90); // Center calculation
    });

    it('should handle content larger than container', () => {
      // Mock larger content
      (window.getComputedStyle as jest.Mock).mockReturnValue({
        transform: 'translate(0px, 0px)',
        width: '1000px',
        height: '800px',
      });

      const result = calculateZoomToFitScale(mockElements, mockContainer);

      // Container: 800x600, Content: 1000x800
      // Padded container: 760x570 (5% padding)
      // Scale: min(760/1000, 570/800) = min(0.76, 0.7125) = 0.7125
      expect(result.scale).toBeCloseTo(0.7125);
    });

    it('should handle content with offset position', () => {
      // Mock content with transform offset
      (window.getComputedStyle as jest.Mock).mockReturnValue({
        transform: 'translate(100px, 50px)',
        width: '200px',
        height: '150px',
      });

      const result = calculateZoomToFitScale(mockElements, mockContainer);

      // Content bounds: left=100, top=50, right=300, bottom=200
      // Content dimensions: 200x150
      // Content center: 200, 125
      expect(result.scale).toBeCloseTo(2.85); // min(760/200, 570/150)
      expect(result.centerX).toBeCloseTo(60); // Adjusted for offset
      expect(result.centerY).toBeCloseTo(42.5); // Adjusted for offset
    });

    it('should handle zero padding', () => {
      const result = calculateZoomToFitScale(mockElements, mockContainer, 0);

      // Container: 800x600, Content: 400x300
      // No padding, so full container: 800x600
      // Scale: min(800/400, 600/300) = min(2, 2) = 2
      expect(result.scale).toBeCloseTo(2);
    });

    it('should handle multiple elements', () => {
      const mockElement1 = document.createElement('div');
      const mockElement2 = document.createElement('div');
      mockElements = [mockElement1, mockElement2];

      (window.getComputedStyle as jest.Mock)
        .mockReturnValueOnce({
          transform: 'translate(0px, 0px)',
          width: '100px',
          height: '80px',
        })
        .mockReturnValueOnce({
          transform: 'translate(200px, 150px)',
          width: '150px',
          height: '120px',
        });

      const result = calculateZoomToFitScale(mockElements, mockContainer);

      // Combined bounds: left=0, top=0, right=350, bottom=270
      // Combined dimensions: 350x270
      // Scale with 5% padding: min(760/350, 570/270) ≈ min(2.17, 2.11) = 2.11
      expect(result.scale).toBeCloseTo(2.11, 1);
    });

    it('should handle very small container', () => {
      mockContainer.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 100,
        height: 50,
      });

      const result = calculateZoomToFitScale(mockElements, mockContainer);

      // Container: 100x50, Content: 400x300
      // Padded container: 90x45 (5% padding)
      // Scale: min(90/400, 45/300) = min(0.225, 0.15) = 0.15
      expect(result.scale).toBeCloseTo(0.15);
    });
  });
});
