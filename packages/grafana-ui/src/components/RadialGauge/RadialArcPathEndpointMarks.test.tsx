import { render, type RenderResult } from '@testing-library/react';

import { createTheme, type FieldDisplay } from '@grafana/data';

import { RadialArcPathEndpointMarks, type RadialArcPathEndpointMarksProps } from './RadialArcPathEndpointMarks';
import { SpotlightGradient } from './effects';
import { type RadialGaugeDimensions } from './types';

const ser = new XMLSerializer();

const expectHTML = (result: RenderResult, expected: string) => {
  let actual = ser.serializeToString(result.asFragment()).replace(/xmlns=".*?" /g, '');
  expect(actual).toEqual(expected.replace(/^\s*|\n/gm, ''));
};

describe('RadialArcPathEndpointMarks', () => {
  const defaultDimensions = Object.freeze({
    centerX: 100,
    centerY: 100,
    radius: 80,
    circumference: 2 * Math.PI * 80,
    barWidth: 20,
    vizWidth: 200,
    vizHeight: 200,
    margin: 10,
    barIndex: 0,
    thresholdsBarRadius: 0,
    thresholdsBarWidth: 0,
    thresholdsBarSpacing: 0,
    scaleLabelsFontSize: 0,
    scaleLabelsSpacing: 0,
    scaleLabelsRadius: 0,
    gaugeBottomY: 0,
  }) satisfies RadialGaugeDimensions;

  const defaultFieldDisplay = Object.freeze({
    name: 'Test',
    field: {},
    display: { text: '50', numeric: 50, color: '#FF0000' },
    hasLinks: false,
  }) satisfies FieldDisplay;

  const defaultProps = Object.freeze({
    arcLengthDeg: 90,
    dimensions: defaultDimensions,
    fieldDisplay: defaultFieldDisplay,
    startAngle: 0,
    xStart: 100,
    xEnd: 150,
    yStart: 100,
    yEnd: 50,
  }) satisfies Omit<RadialArcPathEndpointMarksProps, 'color' | 'gradient' | 'endpointMarker'>;

  it('renders the expected marks when endpointMarker is "point" w/ a static color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} endpointMarker="point" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"100\" cy=\"100\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/></svg>'
    );
  });

  it('renders the expected marks when endpointMarker is "point" w/ a gradient color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            endpointMarker="point"
            gradient={[
              { color: '#00FF00', percent: 0 },
              { color: '#0000FF', percent: 1 },
            ]}
          />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"100\" cy=\"100\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#fbfbfb\" opacity=\"0.5\"/></svg>'
    );
  });

  const glowEndpoints = { xStart: 100, yStart: 20, xEnd: 180, yEnd: 100 };

  it('renders the expected marks when endpointMarker is "glow" w/ a static color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} {...glowEndpoints} endpointMarker="glow" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><path d=\"M 178.78462024097664 113.89185421335442 A 80 80 0 0 0 180 100\" fill=\"none\" stroke-width=\"20\" stroke-linecap=\"round\"/></svg>'
    );
  });

  it('renders the expected marks when endpointMarker is "glow" w/ a gradient color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            {...glowEndpoints}
            endpointMarker="glow"
            gradient={[
              { color: '#00FF00', percent: 0 },
              { color: '#0000FF', percent: 1 },
            ]}
          />
        </svg>
      ),
      '<svg role=\"img\"><path d=\"M 178.78462024097664 113.89185421335442 A 80 80 0 0 0 180 100\" fill=\"none\" stroke-width=\"20\" stroke-linecap=\"round\"/></svg>'
    );
  });

  it('follows the 10 degree arc when the glow marker is at the arc start', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            {...glowEndpoints}
            markerAtStart
            endpointMarker="glow"
            color="#FF0000"
          />
        </svg>
      ),
      '<svg role=\"img\"><path d=\"M 86.10814578664558 21.215379759023364 A 80 80 0 0 1 100 20\" fill=\"none\" stroke-width=\"20\" stroke-linecap=\"round\"/></svg>'
    );
  });

  it.each([
    { side: 'start', bloomAtStart: true, expectedY: 90.02602132918178 },
    { side: 'end', bloomAtStart: false, expectedY: 109.97397867081822 },
  ])('offsets the bloom beyond the $side endcap', ({ bloomAtStart, expectedY }) => {
    const { container } = render(
      <svg>
        <SpotlightGradient
          id="spotlight"
          dimensions={defaultDimensions}
          roundedBars
          angle={90}
          theme={createTheme({ colors: { mode: 'dark' } })}
          color="#FF0000"
          bloomAtStart={bloomAtStart}
        />
      </svg>
    );

    const gradient = container.querySelector('radialGradient');
    expect(gradient).toBeInTheDocument();
    expect(Number(gradient?.getAttribute('cx'))).toBeCloseTo(179.3758133783463, 5);
    expect(Number(gradient?.getAttribute('cy'))).toBeCloseTo(expectedY, 5);
    expect(Number(gradient?.getAttribute('fx'))).toBeCloseTo(179.3758133783463, 5);
    expect(Number(gradient?.getAttribute('fy'))).toBeCloseTo(expectedY, 5);
  });

  it('renders the single point marker at the arc start when the value is left of neutral', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            arcLengthDeg={5}
            markerAtStart
            endpointMarker="point"
            color="#FF0000"
          />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"100\" cy=\"100\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/></svg>'
    );
  });

  it('does not render the start mark when arcLengthDeg is less than the minimum angle for "point" endpointMarker', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} arcLengthDeg={5} endpointMarker="point" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/></svg>'
    );
  });

  it('does not render anything when arcLengthDeg is less than the minimum angle for "glow" endpointMarker', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} arcLengthDeg={5} endpointMarker="glow" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"/>'
    );
  });

  it('does not render anything if endpointMarker is some other value', () => {
    expectHTML(
      render(
        <svg role="img">
          {/* @ts-ignore: confirming the component doesn't throw */}
          <RadialArcPathEndpointMarks {...defaultProps} endpointMarker="foo" />
        </svg>
      ),
      '<svg role=\"img\"/>'
    );
  });
});
