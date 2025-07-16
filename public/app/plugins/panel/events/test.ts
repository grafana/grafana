// Simple test to verify events panel integration
import { EventsPanel } from './EventsPanel';

// Test that the component can be imported
console.log('EventsPanel imported successfully:', typeof EventsPanel);

// Test that the component is a function (React component)
if (typeof EventsPanel === 'function') {
    console.log('✅ EventsPanel is a valid React component');
} else {
    console.log('❌ EventsPanel is not a valid React component');
} 