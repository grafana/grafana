import path from 'path';

/**
 * Determine feature area from file path
 */
export function getFeatureArea(filePath, mappings) {
  for (const [pathPattern, featureArea] of Object.entries(mappings)) {
    if (filePath.includes(pathPattern)) {
      return featureArea;
    }
  }

  // Fallback: try to extract from path
  const parts = filePath.split('/');
  const featuresIndex = parts.indexOf('features');

  if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
    const feature = parts[featuresIndex + 1];
    return feature.charAt(0).toUpperCase() + feature.slice(1);
  }

  return 'General';
}

/**
 * Sanitize text to create valid JavaScript identifier
 */
export function sanitizeIdentifier(text) {
  if (!text) return 'unknown';

  return text
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .split(/[\s-_]+/) // Split on spaces, hyphens, underscores
    .map((word, index) => {
      // camelCase
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('')
    .replace(/^(\d)/, '_$1'); // Prefix with underscore if starts with number
}

/**
 * Generate selector name for menu item
 */
export function generateMenuItemName(component) {
  // Priority order for naming:
  // 1. aria-label
  // 2. Text content
  // 3. Icon + context
  // 4. onClick function name

  if (component.ariaLabel) {
    return sanitizeIdentifier(component.ariaLabel);
  }

  if (component.textContent) {
    return sanitizeIdentifier(component.textContent);
  }

  if (component.icon) {
    const iconName = sanitizeIdentifier(component.icon);
    return component.parentComponent
      ? `${sanitizeIdentifier(component.parentComponent)}${iconName.charAt(0).toUpperCase() + iconName.slice(1)}`
      : iconName;
  }

  if (component.onClick) {
    const match = component.onClick.match(/handle(\w+)|on(\w+)/i);
    if (match) {
      return sanitizeIdentifier(match[1] || match[2]);
    }
  }

  return `item${component.index || ''}`;
}

/**
 * Generate selector name for toolbar button
 */
export function generateToolbarButtonName(component) {
  // Priority order:
  // 1. aria-label or tooltip
  // 2. Button text
  // 3. Icon name
  // 4. Type prop (e.g., submit, reset)

  if (component.ariaLabel || component.tooltip) {
    return sanitizeIdentifier(component.ariaLabel || component.tooltip);
  }

  if (component.textContent) {
    return sanitizeIdentifier(component.textContent) + 'Button';
  }

  if (component.icon) {
    return sanitizeIdentifier(component.icon) + 'Button';
  }

  if (component.type && component.type !== 'button') {
    return sanitizeIdentifier(component.type) + 'Button';
  }

  return `button${component.index || ''}`;
}

/**
 * Generate selector name for form field
 */
export function generateFormFieldName(component) {
  // Priority order:
  // 1. Field label
  // 2. Name attribute
  // 3. ID attribute
  // 4. Placeholder

  if (component.label) {
    return sanitizeIdentifier(component.label) + 'Input';
  }

  if (component.name) {
    return sanitizeIdentifier(component.name);
  }

  if (component.id) {
    return sanitizeIdentifier(component.id);
  }

  if (component.placeholder) {
    return sanitizeIdentifier(component.placeholder) + 'Input';
  }

  return `input${component.index || ''}`;
}

/**
 * Generate full selector path based on component type
 */
export function generateSelectorPath(component, featureArea, componentType) {
  const base = 'Components';

  let elementName;

  switch (componentType) {
    case 'menu':
      elementName = generateMenuItemName(component);
      return `${base}.${featureArea}.Menu.${elementName}`;

    case 'toolbar':
      elementName = generateToolbarButtonName(component);
      return `${base}.${featureArea}.Toolbar.${elementName}`;

    case 'form':
      elementName = generateFormFieldName(component);
      const formName = component.formContext || 'Form';
      return `${base}.${featureArea}.${formName}.${elementName}`;

    default:
      return `${base}.${featureArea}.${sanitizeIdentifier(component.componentName)}`;
  }
}

/**
 * Detect and resolve naming conflicts
 */
export function resolveConflicts(selectors) {
  const pathCounts = new Map();
  const resolved = [];

  // First pass: count occurrences
  for (const selector of selectors) {
    const path = selector.selectorPath;
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
  }

  // Second pass: resolve conflicts
  const pathIndexes = new Map();

  for (const selector of selectors) {
    const path = selector.selectorPath;
    const count = pathCounts.get(path);

    if (count === 1) {
      // No conflict
      resolved.push(selector);
    } else {
      // Conflict - need to make unique
      const currentIndex = pathIndexes.get(path) || 0;
      pathIndexes.set(path, currentIndex + 1);

      const parts = path.split('.');
      const lastPart = parts.pop();

      // Add context qualifier
      const context = selector.parentComponent ? sanitizeIdentifier(selector.parentComponent) : `v${currentIndex + 1}`;

      const newPath = [...parts, lastPart + context.charAt(0).toUpperCase() + context.slice(1)].join('.');

      resolved.push({
        ...selector,
        selectorPath: newPath,
        testIdValue: `data-testid ${newPath.replace(/\./g, ' ')}`,
        hasConflict: true,
        originalPath: path,
      });
    }
  }

  return resolved;
}

/**
 * Validate selector path format
 */
export function isValidSelectorPath(path) {
  // Must match pattern: Components.FeatureArea.Category.name
  const pattern = /^Components\.[A-Z][a-zA-Z0-9]+(\.[A-Z][a-zA-Z0-9]+)*\.[a-z][a-zA-Z0-9]+$/;
  return pattern.test(path);
}
