import { usePlotConfig } from './hooks';
import { renderHook, act } from '@testing-library/react-hooks';

describe('usePlotConfig', () => {
  it('returns default plot config', async () => {
    const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
    await waitForNextUpdate();

    expect(result.current.currentConfig).toMatchInlineSnapshot(`
      Object {
        "axes": Array [],
        "cursor": Object {
          "focus": Object {
            "prox": 30,
          },
        },
        "focus": Object {
          "alpha": 1,
        },
        "height": 0,
        "hooks": Object {},
        "legend": Object {
          "show": false,
        },
        "plugins": Array [],
        "scales": Object {},
        "series": Array [
          Object {},
        ],
        "tzDate": [Function],
        "width": 0,
      }
    `);
  });
  describe('series config', () => {
    it('should add series', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addSeries = result.current.addSeries;

      act(() => {
        addSeries({
          stroke: '#ff0000',
        });
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.series).toHaveLength(2);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
            Object {
              "stroke": "#ff0000",
            },
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should update series', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addSeries = result.current.addSeries;

      act(() => {
        const { updateSeries } = addSeries({
          stroke: '#ff0000',
        });

        updateSeries({
          stroke: '#00ff00',
        });
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.series).toHaveLength(2);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
            Object {
              "stroke": "#00ff00",
            },
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should remove series', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addSeries = result.current.addSeries;

      act(() => {
        const { removeSeries } = addSeries({
          stroke: '#ff0000',
        });

        removeSeries();
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.series).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });
  });

  describe('axis config', () => {
    it('should add axis', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addAxis = result.current.addAxis;

      act(() => {
        addAxis({
          side: 1,
        });
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.axes).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [
            Object {
              "side": 1,
            },
          ],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should update axis', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addAxis = result.current.addAxis;

      act(() => {
        const { updateAxis } = addAxis({
          side: 1,
        });

        updateAxis({
          side: 3,
        });
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.axes).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [
            Object {
              "side": 3,
            },
          ],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should remove axis', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addAxis = result.current.addAxis;

      act(() => {
        const { removeAxis } = addAxis({
          side: 1,
        });

        removeAxis();
      });
      await waitForNextUpdate();

      expect(result.current.currentConfig?.axes).toHaveLength(0);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });
  });

  describe('scales config', () => {
    it('should add scale', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addScale = result.current.addScale;

      act(() => {
        addScale('x', {
          time: true,
        });
      });
      await waitForNextUpdate();

      expect(Object.keys(result.current.currentConfig?.scales!)).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {
            "x": Object {
              "time": true,
            },
          },
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should update scale', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addScale = result.current.addScale;

      act(() => {
        const { updateScale } = addScale('x', {
          time: true,
        });

        updateScale({
          time: false,
        });
      });
      await waitForNextUpdate();

      expect(Object.keys(result.current.currentConfig?.scales!)).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {
            "x": Object {
              "time": false,
            },
          },
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should remove scale', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const addScale = result.current.addScale;

      act(() => {
        const { removeScale } = addScale('x', {
          time: true,
        });

        removeScale();
      });
      await waitForNextUpdate();

      expect(Object.keys(result.current.currentConfig?.scales!)).toHaveLength(0);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });
  });

  describe('plugins config', () => {
    it('should register plugin', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const registerPlugin = result.current.registerPlugin;

      act(() => {
        registerPlugin({
          id: 'testPlugin',
          hooks: {},
        });
      });
      await waitForNextUpdate();

      expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(1);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [
            Object {
              "hooks": Object {},
            },
          ],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });

    it('should unregister plugin', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePlotConfig(0, 0, 'browser'));
      const registerPlugin = result.current.registerPlugin;

      let unregister: () => void;
      act(() => {
        unregister = registerPlugin({
          id: 'testPlugin',
          hooks: {},
        });
      });
      await waitForNextUpdate();

      expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(1);

      act(() => {
        unregister();
      });

      expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(0);
      expect(result.current.currentConfig).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "focus": Object {
              "prox": 30,
            },
          },
          "focus": Object {
            "alpha": 1,
          },
          "height": 0,
          "hooks": Object {},
          "legend": Object {
            "show": false,
          },
          "plugins": Array [],
          "scales": Object {},
          "series": Array [
            Object {},
          ],
          "tzDate": [Function],
          "width": 0,
        }
      `);
    });
  });
});
