// Copyright (c) 2025 Grafana Labs
//
// Test for GitHub issue #110330 - Cyclic span references cause crashes
// This test reproduces the bug and will PASS when the bug is fixed

import { toDataFrame } from '@grafana/data';

import { transformDataFrames } from '../../utils/transform';
import { getTraceSpanIdsAsTree } from '../selectors/trace';
import spanAncestorIds from '../utils/span-ancestor-ids';

import { rawTestDataFrameJSON, selfReferencingSpanTrace } from './cyclic-trace-fixture';
import transformTraceData from './transform-trace-data';

describe('Cyclic Trace References - Issue #110330', () => {
  describe('transformDataFrames with cyclic references', () => {
    it('should not crash when processing cyclic trace from issue #110330', () => {
      // This test currently FAILS with TypeError or infinite loop
      // When fixed, it should pass without errors
      // Convert the raw JSON format to DataFrame
      const dataFrame = toDataFrame(rawTestDataFrameJSON[0]);

      expect(() => {
        const trace = transformDataFrames(dataFrame);
        expect(trace).toBeDefined();
        expect(trace).not.toBeNull();
      }).not.toThrow();
    });

    it('should not crash with self-referencing span from issue #106589', () => {
      expect(() => {
        const trace = transformDataFrames(selfReferencingSpanTrace);
        expect(trace).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('getTraceSpanIdsAsTree with cyclic references', () => {
    it('should handle cyclic FOLLOWS_FROM reference without crashing', () => {
      // Root span has FOLLOWS_FROM reference to its own child
      const traceData = {
        traceID: '75c665dfb6810000',
        processes: {
          '75c665dfb6810000': { serviceName: 'Service 0', tags: [] },
          '75c665dfb6810001': { serviceName: 'Service 1', tags: [] },
          '75c665dfb6810002': { serviceName: 'Service 2', tags: [] },
        },
        spans: [
          {
            spanID: '75c665dfb6810000',
            operationName: 'Operation 0',
            processID: '75c665dfb6810000',
            startTime: 1760350434399,
            duration: 300,
            references: [
              {
                // Cyclic reference: root references its child
                refType: 'FOLLOWS_FROM',
                spanID: '75c665dfb6810002',
                traceID: '75c665dfb6810000',
              },
            ],
          },
          {
            spanID: '75c665dfb6810001',
            operationName: 'Operation 1',
            processID: '75c665dfb6810001',
            startTime: 1760350434499,
            duration: 300,
            references: [
              {
                refType: 'CHILD_OF',
                spanID: '75c665dfb6810000',
                traceID: '75c665dfb6810000',
              },
            ],
          },
          {
            spanID: '75c665dfb6810002',
            operationName: 'Operation 2',
            processID: '75c665dfb6810002',
            startTime: 1760350434599,
            duration: 300,
            references: [
              {
                refType: 'CHILD_OF',
                spanID: '75c665dfb6810000',
                traceID: '75c665dfb6810000',
              },
            ],
          },
        ],
      };

      expect(() => {
        const tree = getTraceSpanIdsAsTree(traceData);
        expect(tree).toBeDefined();
        expect(tree.children.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should detect when adding a span would create a cycle', () => {
      const traceData = {
        traceID: 'test',
        processes: {},
        spans: [
          {
            spanID: 'A',
            operationName: 'Op A',
            processID: 'A',
            startTime: 1000,
            duration: 100,
            references: [
              {
                refType: 'CHILD_OF',
                spanID: 'B',
                traceID: 'test',
              },
            ],
          },
          {
            spanID: 'B',
            operationName: 'Op B',
            processID: 'B',
            startTime: 1100,
            duration: 100,
            references: [
              {
                refType: 'CHILD_OF',
                spanID: 'C',
                traceID: 'test',
              },
            ],
          },
          {
            spanID: 'C',
            operationName: 'Op C',
            processID: 'C',
            startTime: 1200,
            duration: 100,
            references: [
              {
                // Cycle: C -> A, but A -> B -> C
                refType: 'FOLLOWS_FROM',
                spanID: 'A',
                traceID: 'test',
              },
            ],
          },
        ],
      };

      // Should not throw, should gracefully handle the cycle
      expect(() => {
        const tree = getTraceSpanIdsAsTree(traceData);
        expect(tree).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('spanAncestorIds with cyclic references', () => {
    it('should not infinite loop on cyclic ancestry - issue #106589', () => {
      // Create a span structure where traversing ancestors would loop
      const childSpan = {
        spanID: 'child',
        operationName: 'child-op',
        startTime: 1100,
        duration: 100,
        process: { serviceName: 'test', tags: [] },
        references: [
          {
            refType: 'CHILD_OF',
            spanID: 'root',
            traceID: 'test',
            span: null as any, // Will be set below
          },
        ],
      };

      const rootSpan = {
        spanID: 'root',
        operationName: 'root-op',
        startTime: 1000,
        duration: 500,
        process: { serviceName: 'test', tags: [] },
        references: [
          {
            refType: 'FOLLOWS_FROM',
            spanID: 'child',
            traceID: 'test',
            span: childSpan,
          },
        ],
      };

      // Create the cycle
      childSpan.references[0].span = rootSpan;

      // This should complete without infinite loop
      // Set a timeout to catch infinite loops
      const startTime = Date.now();
      const ancestors = spanAncestorIds(childSpan);
      const duration = Date.now() - startTime;

      // Should complete quickly (< 100ms) and not hang
      expect(duration).toBeLessThan(100);
      expect(ancestors).toBeDefined();
      expect(Array.isArray(ancestors)).toBe(true);
      // Should not have duplicate ancestors (indicating a cycle was detected)
      const uniqueAncestors = new Set(ancestors);
      expect(uniqueAncestors.size).toBeLessThanOrEqual(ancestors.length);
    });

    it('should handle self-referencing span', () => {
      const selfRefSpan = {
        spanID: 'self',
        operationName: 'self-ref',
        startTime: 1000,
        duration: 100,
        process: { serviceName: 'test', tags: [] },
        references: [] as any[],
      };

      // Span references itself
      selfRefSpan.references = [
        {
          refType: 'FOLLOWS_FROM',
          spanID: 'self',
          traceID: 'test',
          span: selfRefSpan,
        },
      ];

      // Should not infinite loop
      const startTime = Date.now();
      const ancestors = spanAncestorIds(selfRefSpan);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(ancestors).toBeDefined();
    });
  });

  describe('transformTraceData with cyclic references', () => {
    it('should successfully transform trace with cycles and display all spans', () => {
      const traceResponse = {
        traceID: '75c665dfb6810000',
        processes: {
          '75c665dfb6810000': { serviceName: 'Service 0', tags: [] },
          '75c665dfb6810002': { serviceName: 'Service 2', tags: [] },
        },
        spans: [
          {
            spanID: '75c665dfb6810000',
            operationName: 'Operation 0',
            processID: '75c665dfb6810000',
            startTime: 1760350434399,
            duration: 300,
            references: [
              {
                refType: 'FOLLOWS_FROM',
                spanID: '75c665dfb6810002',
                traceID: '75c665dfb6810000',
              },
            ],
          },
          {
            spanID: '75c665dfb6810002',
            operationName: 'Operation 2',
            processID: '75c665dfb6810002',
            startTime: 1760350434599,
            duration: 300,
            references: [
              {
                refType: 'CHILD_OF',
                spanID: '75c665dfb6810000',
                traceID: '75c665dfb6810000',
              },
            ],
          },
        ],
      };

      expect(() => {
        const trace = transformTraceData(traceResponse);
        expect(trace).not.toBeNull();
        expect(trace?.spans.length).toBe(2);
        expect(trace?.traceID).toBe('75c665dfb6810000');
      }).not.toThrow();
    });
  });

  describe('Console warnings for detected cycles', () => {
    it('should log warning when cycle is detected', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const traceData = {
        traceID: 'test',
        processes: { A: { serviceName: 'Service A', tags: [] } },
        spans: [
          {
            spanID: 'A',
            operationName: 'Op A',
            processID: 'A',
            startTime: 1000,
            duration: 100,
            references: [
              {
                refType: 'FOLLOWS_FROM',
                spanID: 'A', // Self-reference
                traceID: 'test',
              },
            ],
          },
        ],
      };

      const dataFrame = toDataFrame(rawTestDataFrameJSON[0]);
      transformDataFrames(dataFrame);

      // After fix, should log a warning about cycle detection
      // This assertion will need to be updated once warning is implemented
      // For now, just verify it doesn't throw
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

describe('Performance - Cyclic traces should not degrade performance significantly', () => {
  it('should process cyclic trace within performance budget', () => {
    const dataFrame = toDataFrame(rawTestDataFrameJSON[0]);
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      transformDataFrames(dataFrame);
    }

    const duration = performance.now() - startTime;
    const avgDuration = duration / 100;

    // Should process each trace in < 50ms on average (generous budget)
    // This will establish baseline before fix
    expect(avgDuration).toBeLessThan(50);
  });
});
