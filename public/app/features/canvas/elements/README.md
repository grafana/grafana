# Canvas Elements Developer Guide

This directory contains custom canvas elements for Grafana's Canvas panel. This guide will help you create new custom elements that integrate seamlessly with Grafana's UI system and theming.

## Overview

Canvas elements are reusable UI components that can be placed and configured within a Canvas panel. Each element consists of:

- **Display Component**: The visual representation of the element
- **Configuration Interface**: Options panel for customizing the element
- **Data Integration**: Binding to data sources and fields
- **Styling System**: Integration with Grafana's theme and UI components

## Basic Element Structure

Every canvas element follows this pattern:

```typescript
export const myCustomItem: CanvasElementItem<ConfigType, DataType> = {
  id: 'my-custom-element',
  name: 'My Custom Element',
  description: 'Description of what this element does',

  display: MyCustomDisplay,

  defaultSize: {
    width: 100,
    height: 50,
  },

  getNewOptions: (options) => ({
    // Default configuration
  }),

  prepareData: (dimensionContext, elementOptions) => {
    // Process and transform data
  },

  registerOptionsUI: (builder) => {
    // Register configuration options
  },
};
```

## Creating the Display Component

### Basic Component Structure

```typescript
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface MyElementData {
  text?: string;
  color?: string;
  // ... other data properties
}

interface MyElementConfig {
  // Configuration properties
}

const MyCustomDisplay = ({ data }: CanvasElementProps<MyElementConfig, MyElementData>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {/* Your element content */}
    </div>
  );
};
```

### Styling with Grafana UI

#### Using the Theme System

```typescript
const getStyles = (theme: GrafanaTheme2, data?: MyElementData) => ({
  container: css({
    height: '100%',
    width: '100%',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.borderRadius(),
    padding: theme.spacing(1),
  }),
  text: css({
    fontSize: `${data?.size || 14}px`,
    color: data?.color || theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
  }),
});
```

#### Responsive and Dynamic Styling

```typescript
const getStyles = (theme: GrafanaTheme2, data?: MyElementData) => {
  const textAlign = data?.align === Align.Center ? '50%' : data?.align === Align.Left ? '10%' : '90%';

  return {
    container: css({
      position: 'relative',
      height: '100%',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    text: css({
      position: 'absolute',
      left: textAlign,
      transform: data?.align === Align.Center ? 'translateX(-50%)' : 'none',
      fontSize: `${data?.size}px`,
      color: data?.color,
      transition: theme.transitions.create(['color', 'font-size']),
    }),
  };
};
```

#### Using Grafana UI Components

```typescript
import { Button, Input, Spinner } from '@grafana/ui';

const MyCustomDisplay = ({ data }: CanvasElementProps<MyElementConfig, MyElementData>) => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div>
      <Button
        variant="primary"
        size="sm"
        disabled={isLoading}
      >
        {isLoading && <Spinner inline />}
        {data?.buttonText}
      </Button>
    </div>
  );
};
```

## Configuration Options

### Registering Options UI

The `registerOptionsUI` function defines the configuration panel:

```typescript
registerOptionsUI: (builder) => {
  const category = ['My Element'];

  builder
    .addCustomEditor({
      category,
      id: 'textSelector',
      path: 'config.text',
      name: 'Text',
      editor: TextDimensionEditor,
    })
    .addCustomEditor({
      category,
      id: 'colorSelector',
      path: 'config.color',
      name: 'Color',
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: { fixed: theme.colors.text.primary },
    })
    .addRadio({
      category,
      path: 'config.align',
      name: 'Text Alignment',
      settings: {
        options: [
          { value: Align.Left, label: 'Left' },
          { value: Align.Center, label: 'Center' },
          { value: Align.Right, label: 'Right' },
        ],
      },
      defaultValue: Align.Center,
    })
    .addNumberInput({
      category,
      path: 'config.size',
      name: 'Font Size',
      settings: {
        placeholder: 'Auto',
        min: 8,
        max: 72,
      },
    });
};
```

### Available Option Types

#### Dimension Editors

- **TextDimensionEditor**: Text input with field binding support
- **ColorDimensionEditor**: Color picker with theme colors and field binding
- **ScalarDimensionEditor**: Numeric input with field binding
- **ResourceDimensionEditor**: File/resource selector

#### Standard Inputs

- **addRadio**: Radio button group
- **addSelect**: Dropdown selection
- **addNumberInput**: Numeric input field
- **addTextInput**: Text input field
- **addBooleanSwitch**: Toggle switch
- **addSliderInput**: Range slider

#### Custom Editors

```typescript
.addCustomEditor({
  category,
  id: 'myCustomEditor',
  path: 'config.customProperty',
  name: 'Custom Setting',
  editor: MyCustomEditor, // Your custom React component
  settings: {
    // Custom settings passed to your editor
  },
})
```

## Data Processing

### The prepareData Function

```typescript
prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<MyElementConfig>) => {
  const config = elementOptions.config;

  const data: MyElementData = {
    text: config?.text ? dimensionContext.getText(config.text).value() : '',
    size: config?.size ?? 14,
    align: config?.align ?? Align.Center,
  };

  // Process color dimension
  if (config?.color) {
    data.color = dimensionContext.getColor(config.color).value();
  }

  // Process background from element options
  const { background, border } = elementOptions;
  data.backgroundColor = background?.color ? dimensionContext.getColor(background.color).value() : defaultBgColor;

  return data;
};
```

### Working with Different Data Types

```typescript
// Text data with field binding
text: config?.text ? dimensionContext.getText(config.text).value() : '';

// Numeric data with field binding
value: config?.value ? dimensionContext.getScalar(config.value).value() : 0;

// Color data with theme support
color: config?.color ? dimensionContext.getColor(config.color).value() : theme.colors.text.primary;

// Resource/file data
imagePath: config?.image ? dimensionContext.getResource(config.image).value() : undefined;
```

## Advanced Features

### Edit Mode Support

For elements that support inline editing:

```typescript
export const myTextItem: CanvasElementItem = {
  // ... other properties
  hasEditMode: true,
  display: MyTextDisplay,
};

const MyTextDisplay = (props: CanvasElementProps) => {
  const { isSelected } = props;
  const context = usePanelContext();
  const scene = context.instanceState?.scene;
  const isEditMode = useObservable<boolean>(scene?.editModeEnabled ?? of(false));

  if (isEditMode && isSelected) {
    return <MyTextEdit {...props} />;
  }

  return <MyTextView {...props} />;
};
```

### Custom Connection Anchors

For elements that support connections:

```typescript
export const myShapeItem: CanvasElementItem = {
  // ... other properties
  customConnectionAnchors: [
    { x: 0, y: -1 }, // top
    { x: 1, y: 0 }, // right
    { x: 0, y: 1 }, // bottom
    { x: -1, y: 0 }, // left
  ],
};
```

### SVG Elements

For SVG-based elements:

```typescript
const MySVGDisplay = ({ data }: CanvasElementProps) => {
  const uniqueId = uuidv4(); // Avoid ID conflicts

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <pattern id={`pattern-${uniqueId}`}>
          {/* Pattern definition */}
        </pattern>
      </defs>
      <rect
        fill={data?.backgroundColor}
        stroke={data?.borderColor}
        strokeWidth={data?.borderWidth}
      />
    </svg>
  );
};
```

## Best Practices

### Performance

- Use `useStyles2` for theming instead of inline styles
- Memoize expensive calculations
- Use `PureComponent` or `React.memo` when appropriate

### Accessibility

- Provide proper ARIA labels
- Ensure keyboard navigation support
- Use semantic HTML elements

### Theming

- Always use theme colors instead of hardcoded values
- Support both light and dark themes
- Use theme spacing and typography scales

### Responsive Design

- Use percentage-based layouts when possible
- Consider different screen sizes
- Test with various canvas sizes

### Internationalization

```typescript
import { t } from '@grafana/i18n';

// Use translation keys
name: t('canvas.my-element.name', 'My Element');
```

## Examples

### Simple Text Element

A basic text element with inline editing support and theming integration.

- **File**: [text.tsx](./text.tsx)
- **Features**: Inline editing, text alignment, font sizing, color theming

### Interactive Button Element

A button element with API integration and loading states.

- **File**: [button.tsx](./button.tsx)
- **Features**: API calls, loading states, button styling, click handlers

### Data-Driven Element

Display field values from data sources with fallback handling.

- **File**: [metricValue.tsx](./metricValue.tsx)
- **Features**: Field binding, data validation, edit mode field selection

### Animated Element

Wind turbine with RPM-based rotation animation.

- **File**: [windTurbine.tsx](./windTurbine.tsx)
- **Features**: CSS animations, scalar data binding, SVG graphics

### Complex Shapes with SVG

Various geometric shapes with custom connection points and styling.

- **Triangle**: [triangle.tsx](./triangle.tsx)
- **Ellipse**: [ellipse.tsx](./ellipse.tsx)
- **Cloud**: [cloud.tsx](./cloud.tsx)
- **Parallelogram**: [parallelogram.tsx](./parallelogram.tsx)
- **Features**: Custom SVG paths, connection anchors, background images, clipping

### Dynamic SVG Elements

Advanced SVG elements with data-driven transformations.

- **Drone Top View**: [droneTop.tsx](./droneTop.tsx) - Multiple rotor animations
- **Drone Front View**: [droneFront.tsx](./droneFront.tsx) - Roll angle rotation
- **Drone Side View**: [droneSide.tsx](./droneSide.tsx) - Pitch angle rotation
- **Features**: Multiple animations, transform origins, coordinate systems

### Icon Element

SVG icon display with theming and stroke support.

- **File**: [icon.tsx](./icon.tsx)
- **Features**: Resource binding, SVG sanitization, stroke styling

### Server Infrastructure Elements

Comprehensive server visualization elements with multiple variants and status indicators.

- **Main Server Element**: [server/server.tsx](./server/server.tsx) - Factory element with multiple server types
- **Server Types**:
  - **Single Server**: [server/types/single.tsx](./server/types/single.tsx)
  - **Server Stack**: [server/types/stack.tsx](./server/types/stack.tsx)
  - **Database Server**: [server/types/database.tsx](./server/types/database.tsx)
  - **Terminal Server**: [server/types/terminal.tsx](./server/types/terminal.tsx)
- **Features**: Multiple variants, status colors, blinking animations, motion-safe animations, SVG composition, type selection dropdown

### Basic Shape Elements

Simple rectangular elements for basic layouts.

- **Rectangle**: [rectangle.tsx](./rectangle.tsx) - Basic text container
- **Features**: Simple styling, table-cell layout, basic text positioning

## Testing

### Unit Tests

- Test data processing logic
- Test configuration options
- Test rendering with different props

### Integration Tests

- Test within Canvas panel
- Test theme switching
- Test responsive behavior

## Common Patterns

### Default Options Structure

```typescript
getNewOptions: (options) => ({
  ...options,
  config: {
    // Element-specific config
    text: { mode: TextDimensionMode.Fixed, fixed: 'Default Text' },
    color: { fixed: defaultTextColor },
    size: 14,
  },
  background: {
    color: { fixed: 'transparent' },
  },
  placement: {
    width: options?.placement?.width ?? 100,
    height: options?.placement?.height ?? 50,
    top: options?.placement?.top,
    left: options?.placement?.left,
    rotation: options?.placement?.rotation ?? 0,
  },
  links: options?.links ?? [],
});
```

This guide should help you create custom canvas elements that integrate seamlessly with Grafana's design system and provide a consistent user experience.
